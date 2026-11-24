# Local Turnstile tests

These tests use Cloudflare's documented dummy keys only. They do not change the committed `TURNSTILE_SITE_KEY` placeholder, and they do not call the live Apps Script /exec URL.

From the repository root:

    node tests/run-turnstile-tests.js
    python3 tests/form-widget-test.py

The Node script checks `Code.gs` behavior (recipient lock, honeypot, secret-gated enforcement) and calls Cloudflare siteverify with the dummy pass and fail secrets.

The Python script opens a temporary copy of the form in Chrome, injects dummy site keys only in that copy, and posts to a local mock endpoint.
