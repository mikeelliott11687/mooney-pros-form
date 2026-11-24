/**
 * Local tests for the Mooney Pros training-form Turnstile changes.
 * Uses Cloudflare's documented dummy keys only. Does not write those keys
 * into index.html or Code.gs defaults, and does not call the live Apps Script.
 *
 *   node tests/run-turnstile-tests.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const https = require('https');
const { URLSearchParams } = require('url');

const ROOT = path.resolve(__dirname, '..');
const CODE_GS = path.join(ROOT, 'apps-script', 'Code.gs');
const INDEX = path.join(ROOT, 'index.html');

const DUMMY_PASS_SITE = '1x00000000000000000000AA';
const DUMMY_FAIL_SITE = '2x00000000000000000000AB';
const DUMMY_PASS_SECRET = '1x0000000000000000000000000000000AA';
const DUMMY_FAIL_SECRET = '2x0000000000000000000000000000000AA';
const DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';
const FAKE_PDF = 'A'.repeat(80);

let passed = 0;
let failed = 0;

function assert(cond, name, detail) {
  if (cond) {
    passed += 1;
    console.log('  PASS  ' + name);
  } else {
    failed += 1;
    console.log('  FAIL  ' + name + (detail ? '  --  ' + detail : ''));
  }
}

function siteverify(secret, response) {
  const body = new URLSearchParams({ secret, response }).toString();
  return new Promise((resolve, reject) => {
    const req = https.request(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          try {
            resolve({ code: res.statusCode, json: JSON.parse(raw) });
          } catch (err) {
            reject(new Error('Bad siteverify body: ' + raw.slice(0, 200)));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function loadCodeGs(opts) {
  opts = opts || {};
  const secret = Object.prototype.hasOwnProperty.call(opts, 'secret') ? opts.secret : '';
  const siteverifyImpl = opts.siteverifyImpl;
  const sent = [];
  const fetches = [];

  const context = {
    PropertiesService: {
      getScriptProperties: function () {
        return {
          getProperty: function (key) {
            return key === 'TURNSTILE_SECRET' ? secret : null;
          }
        };
      }
    },
    UrlFetchApp: {
      fetch: function (url, options) {
        fetches.push({ url: url, options: options });
        let result;
        if (siteverifyImpl) {
          result = siteverifyImpl(url, options);
        } else {
          throw new Error('UrlFetchApp.fetch called with no stub');
        }
        const code = result.code;
        const text = typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
        return {
          getResponseCode: function () { return code; },
          getContentText: function () { return text; }
        };
      }
    },
    Utilities: {
      base64Decode: function (s) { return Buffer.from(String(s), 'base64'); },
      newBlob: function (bytes, mime, name) {
        return { bytes: bytes, mime: mime, name: name };
      }
    },
    MailApp: {
      sendEmail: function (msg) { sent.push(msg); }
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: function (text) {
        return {
          text: text,
          setMimeType: function (m) { this.mimeType = m; return this; },
          getContent: function () { return this.text; }
        };
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(fs.readFileSync(CODE_GS, 'utf8'), context);

  function post(fields) {
    const out = context.doPost({ parameter: fields || {} });
    return { json: JSON.parse(out.getContent()), sent: sent, fetches: fetches };
  }

  return { post: post, sent: sent, fetches: fetches, context: context };
}

function sampleFields(extra) {
  const fields = {
    pdfBase64: FAKE_PDF,
    clientName: 'Test Pilot',
    email: 'pilot@example.com',
    phone: '3175550100',
    daysRequested: '2',
    trainingDates: 'Jan 1, 2027',
    fileName: 'Mooney_Pros_Training_Agreement_Test_Pilot.pdf',
    to: 'attacker@example.com',
    honeypot: '',
    turnstileToken: ''
  };
  Object.assign(fields, extra || {});
  return fields;
}

async function main() {
  console.log('\n1) Committed defaults do not contain dummy or production-looking secrets');
  const index = fs.readFileSync(INDEX, 'utf8');
  const code = fs.readFileSync(CODE_GS, 'utf8');
  const siteKeyMatch = index.match(/const TURNSTILE_SITE_KEY = '([^']*)'/);
  assert(siteKeyMatch && siteKeyMatch[1] === '0x4AAAAAAGQ8wk9Ezt7tC0gg', 'index.html site key is the live public Site Key');
  assert(siteKeyMatch[1] !== 'TURNSTILE_SITE_KEY', 'index.html no longer uses the placeholder');
  assert(!index.includes(DUMMY_PASS_SITE) && !index.includes(DUMMY_FAIL_SITE), 'index.html has no dummy site keys');
  assert(!index.includes(DUMMY_PASS_SECRET) && !code.includes(DUMMY_PASS_SECRET), 'committed files have no dummy secrets');
  assert(!code.includes('TURNSTILE_SECRET =') || /getProperty\('TURNSTILE_SECRET'\)/.test(code), 'secret is read from Script Properties');
  assert(code.includes("var to = TO_EMAIL") && code.includes("var TO_EMAIL = 'mike@mooneypros.com'"), 'recipient is hard-coded');
  assert(!/var to = data\.to/.test(code), 'client to field is not used');

  console.log('\n2) Cloudflare siteverify dummy keys (live API, not the production form)');
  const pass = await siteverify(DUMMY_PASS_SECRET, DUMMY_TOKEN);
  assert(pass.json && pass.json.success === true, 'dummy pass secret accepts dummy token', JSON.stringify(pass.json));
  const fail = await siteverify(DUMMY_FAIL_SECRET, DUMMY_TOKEN);
  assert(fail.json && fail.json.success === false, 'dummy fail secret rejects dummy token', JSON.stringify(fail.json));

  console.log('\n3) Code.gs rollout and enforcement');

  let r = loadCodeGs({ secret: '' }).post(sampleFields({ turnstileToken: '', to: 'attacker@example.com' }));
  assert(r.json.ok === true && r.json.status === 'success', 'no secret and no token: submission still allowed (rollout safe)');
  assert(r.sent.length === 1 && r.sent[0].to === 'mike@mooneypros.com', 'email goes to mike@mooneypros.com');
  assert(r.sent[0].to !== 'attacker@example.com', 'client-supplied to is ignored');

  r = loadCodeGs({ secret: '' }).post(sampleFields({ honeypot: 'http://spam.example' }));
  assert(r.json.ok === false && r.sent.length === 0, 'filled honeypot is rejected even before the secret is set');

  r = loadCodeGs({
    secret: DUMMY_PASS_SECRET,
    siteverifyImpl: function () { throw new Error('should not verify when token is missing'); }
  }).post(sampleFields({ turnstileToken: '' }));
  assert(r.json.ok === false && /Verification is required/.test(r.json.message) && r.sent.length === 0, 'secret set, missing token: rejected, no email');

  r = loadCodeGs({
    secret: DUMMY_FAIL_SECRET,
    siteverifyImpl: function () { return { code: 200, body: { success: false, 'error-codes': ['invalid-input-response'] } }; }
  }).post(sampleFields({ turnstileToken: DUMMY_TOKEN }));
  assert(r.json.ok === false && /Verification failed/.test(r.json.message) && r.sent.length === 0, 'secret set, failed check: rejected, no email');

  r = loadCodeGs({
    secret: DUMMY_PASS_SECRET,
    siteverifyImpl: function (url, options) {
      if (url !== 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
        return { code: 400, body: { success: false } };
      }
      const payload = options && options.payload;
      if (!payload || payload.secret !== DUMMY_PASS_SECRET || payload.response !== DUMMY_TOKEN) {
        return { code: 200, body: { success: false } };
      }
      return { code: 200, body: { success: true } };
    }
  }).post(sampleFields({ turnstileToken: DUMMY_TOKEN, to: 'attacker@example.com' }));
  assert(r.json.ok === true && r.sent.length === 1 && r.sent[0].to === 'mike@mooneypros.com', 'secret set, valid token: email sent only to mike@mooneypros.com');
  assert(r.sent[0].subject.indexOf('Test Pilot') !== -1, 'existing email subject still includes the client name');
  assert(r.sent[0].attachments && r.sent[0].attachments.length === 1, 'PDF attachment still sent');

  r = loadCodeGs({
    secret: DUMMY_PASS_SECRET,
    siteverifyImpl: function () { return { code: 200, body: { success: true } }; }
  }).post(sampleFields({ turnstileToken: DUMMY_TOKEN, honeypot: 'bot-filled' }));
  assert(r.json.ok === false && r.sent.length === 0, 'filled honeypot is rejected even with a valid token');

  r = loadCodeGs({ secret: '' }).post({ clientName: 'X', to: 'attacker@example.com' });
  assert(r.json.ok === false && /No PDF data/.test(r.json.message) && r.sent.length === 0, 'missing PDF still rejected as before');

  console.log('\n4) Code.gs posts the token to the documented siteverify URL');
  r = loadCodeGs({
    secret: 'unit-secret',
    siteverifyImpl: function (url, options) {
      return { code: 200, body: { success: true } };
    }
  }).post(sampleFields({ turnstileToken: 'tok-1' }));
  assert(
    r.fetches.length === 1 &&
      r.fetches[0].url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify' &&
      r.fetches[0].options.method === 'post' &&
      r.fetches[0].options.payload.response === 'tok-1' &&
      r.fetches[0].options.payload.secret === 'unit-secret',
    'UrlFetchApp POST uses secret + response against siteverify'
  );

  console.log('\nDone: ' + passed + ' passed, ' + failed + ' failed');
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
