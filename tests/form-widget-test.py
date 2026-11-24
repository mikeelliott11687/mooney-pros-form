#!/usr/bin/env python3
"""Browser test of the training form Turnstile widget, using dummy keys only.

Serves a temporary copy of index.html (committed file is not modified) and a
mock Apps Script endpoint. Does not call the live /exec URL.

  python3 tests/form-widget-test.py
"""
from __future__ import annotations

import json
import shutil
import socket
import tempfile
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DUMMY_PASS_SITE = "1x00000000000000000000AA"
DUMMY_FAIL_SITE = "2x00000000000000000000AB"


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class MockHandler(SimpleHTTPRequestHandler):
    received = []  # type: list

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length).decode("utf-8", "replace")
        content_type = self.headers.get("Content-Type") or ""
        if "application/json" in content_type or "text/plain" in content_type:
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                data = {"_raw": raw}
        else:
            parsed = parse_qs(raw, keep_blank_values=True)
            data = {k: (v[0] if v else "") for k, v in parsed.items()}
        MockHandler.received.append(data)
        body = json.dumps({"ok": True, "status": "success", "message": "Email sent."}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        return


def start_server(directory: Path, port: int) -> ThreadingHTTPServer:
    handler = partial(MockHandler, directory=str(directory))
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def write_temp_form(site_key: str, endpoint: str) -> Path:
    tmp = Path(tempfile.mkdtemp(prefix="turnstile-form-"))
    for name in ("index.html", "mooney-pros-training-form.pdf", "mooney-pros-logo.png"):
        shutil.copy(ROOT / name, tmp / name)
    shutil.copytree(ROOT / "vendor", tmp / "vendor")
    html = (tmp / "index.html").read_text()
    html = html.replace(
        "const TURNSTILE_SITE_KEY = 'TURNSTILE_SITE_KEY';",
        "const TURNSTILE_SITE_KEY = '%s';" % site_key,
    )
    html = html.replace(
        'const SUBMIT_ENDPOINT = "https://script.google.com/macros/s/AKfycby1szElrRAWz9MyqvCpE8qQob7z7fZzzDt9GXdMWvYibwRnbNZthbtPUS4YBHR2OU7edg/exec";',
        'const SUBMIT_ENDPOINT = "%s";' % endpoint,
    )
    (tmp / "index.html").write_text(html)
    return tmp


def fill_required(page):
    page.fill("#client_name", "Local Test Pilot")
    page.fill("#phone", "3175550100")
    page.fill("#email", "local-test@example.com")
    page.fill("#address", "123 Hangar Lane")
    page.fill("#days_requested", "1")
    page.check("#acknowledge_terms")
    page.fill("#signature_name", "Local Test Pilot")
    box = page.locator("#sigPad").bounding_box()
    assert box, "signature canvas missing"
    page.mouse.move(box["x"] + 20, box["y"] + 40)
    page.mouse.down()
    page.mouse.move(box["x"] + 120, box["y"] + 80)
    page.mouse.up()


def run():
    passed = 0
    failed = 0

    def check(cond, name, detail=""):
        nonlocal passed, failed
        if cond:
            passed += 1
            print("  PASS  " + name)
        else:
            failed += 1
            print("  FAIL  " + name + (("  --  " + detail) if detail else ""))

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context()

        print("\nA) Placeholder site key: no widget, submit still works")
        MockHandler.received.clear()
        port = free_port()
        endpoint = "http://127.0.0.1:%s/submit" % port
        tmp = write_temp_form("TURNSTILE_SITE_KEY", endpoint)
        server = start_server(tmp, port)
        try:
            page = context.new_page()
            page.goto("http://127.0.0.1:%s/index.html" % port, wait_until="domcontentloaded")
            check(
                page.locator("iframe[src*='challenges.cloudflare.com']").count() == 0,
                "no Turnstile iframe when key is the placeholder",
            )
            fill_required(page)
            page.click("#submitBtn")
            page.locator("#statusBox.ok").wait_for(timeout=30000)
            check(
                "Signed agreement sent" in (page.locator("#statusBox").inner_text() or ""),
                "success message shown without a widget",
            )
            check(len(MockHandler.received) >= 1, "mock endpoint received a submission")
            if MockHandler.received:
                payload = MockHandler.received[-1]
                check(payload.get("honeypot", "") == "", "honeypot is empty for a normal submit")
                check(payload.get("clientName") == "Local Test Pilot", "client fields still submitted")
            page.close()
        finally:
            server.shutdown()
            shutil.rmtree(tmp, ignore_errors=True)

        print("\nB) Dummy always-pass site key: widget, token, successful submit")
        MockHandler.received.clear()
        port = free_port()
        endpoint = "http://127.0.0.1:%s/submit" % port
        tmp = write_temp_form(DUMMY_PASS_SITE, endpoint)
        server = start_server(tmp, port)
        try:
            page = context.new_page()
            page.goto("http://127.0.0.1:%s/index.html" % port, wait_until="domcontentloaded")
            page.wait_for_function(
                "() => typeof turnstile !== 'undefined' && typeof getTurnstileToken === 'function' && getTurnstileToken()",
                timeout=30000,
            )
            token = page.evaluate("getTurnstileToken()")
            widget_present = bool(token) or page.evaluate(
                "() => !!(document.querySelector('#turnstile-container') && document.querySelector('#turnstile-container').children.length)"
            )
            check(widget_present, "Turnstile widget rendered")
            check(bool(token), "widget produced a token", repr(token)[:80])
            fill_required(page)
            page.click("#submitBtn")
            page.locator("#statusBox.ok").wait_for(timeout=30000)
            check(
                "Signed agreement sent" in (page.locator("#statusBox").inner_text() or ""),
                "success message shown with widget",
            )
            check(len(MockHandler.received) >= 1, "mock endpoint received a submission")
            if MockHandler.received:
                payload = MockHandler.received[-1]
                check(bool(payload.get("turnstileToken")), "payload includes turnstileToken")
                check(payload.get("honeypot", "") == "", "honeypot is empty")
                check(
                    payload.get("to") == "mike@mooneypros.com",
                    "form still sends to=mike@mooneypros.com (server will ignore it)",
                )
            page.close()
        finally:
            server.shutdown()
            shutil.rmtree(tmp, ignore_errors=True)

        print("\nC) Dummy always-fail site key: submit is blocked without a usable token")
        MockHandler.received.clear()
        port = free_port()
        endpoint = "http://127.0.0.1:%s/submit" % port
        tmp = write_temp_form(DUMMY_FAIL_SITE, endpoint)
        server = start_server(tmp, port)
        try:
            page = context.new_page()
            page.goto("http://127.0.0.1:%s/index.html" % port, wait_until="domcontentloaded")
            page.wait_for_timeout(3500)
            fill_required(page)
            before = len(MockHandler.received)
            page.click("#submitBtn")
            page.wait_for_timeout(2000)
            status = page.locator("#statusBox").inner_text() or ""
            token = page.evaluate("typeof getTurnstileToken === 'function' ? getTurnstileToken() : ''")
            blocked = "complete the verification check" in status or not token
            check(blocked, "submit does not proceed without a token", "status=" + status + " token=" + repr(token))
            check(len(MockHandler.received) == before, "mock endpoint received no submission without a token")
            page.close()
        finally:
            server.shutdown()
            shutil.rmtree(tmp, ignore_errors=True)

        browser.close()

    print("\nDone: %s passed, %s failed" % (passed, failed))
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    run()
