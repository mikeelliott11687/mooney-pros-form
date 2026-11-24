/**
 * Mooney Pros - Flight Training Request form backend
 * Deploy as Web App: Execute as Me, Who has access: Anyone.
 * Keep the EXISTING /exec deployment URL; Deploy → Manage deployments → Edit → New version.
 *
 * Accepts:
 *  - text/plain or application/json body: JSON with pdfBase64, clientName, email, ...
 *  - application/x-www-form-urlencoded (legacy iframe/form posts) via e.parameter
 *
 * Returns JSON:
 *  { "ok": true,  "status": "success" }
 *  { "ok": false, "status": "error", "message": "..." }
 *
 * Turnstile: the secret lives in Script Properties as TURNSTILE_SECRET, never in this file.
 * If that property is unset or blank, token checks are skipped so a script redeploy
 * does not break the live form before the widget is published. Once the property is
 * set, a missing or invalid token is rejected. A filled honeypot is always rejected.
 * The recipient is always mike@mooneypros.com; a client-supplied "to" field is ignored.
 */
var TO_EMAIL = 'mike@mooneypros.com';
var FROM_NAME = 'Mooney Pros Training Form';
var TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function doGet() {
  return jsonOut({ ok: true, status: 'success', message: 'Mooney Pros form endpoint is live.' });
}

function doPost(e) {
  try {
    var data = readPayload_(e);

    if (honeypotFilled_(data)) {
      return jsonOut({ ok: false, status: 'error', message: 'Submission rejected.' });
    }

    var secret = getTurnstileSecret_();
    if (secret) {
      var token = data.turnstileToken || data['cf-turnstile-response'] || '';
      if (!String(token).trim()) {
        return jsonOut({
          ok: false,
          status: 'error',
          message: 'Verification is required. Please complete the check and try again.'
        });
      }
      var verified = verifyTurnstileToken_(token, secret);
      if (!verified.ok) {
        return jsonOut({
          ok: false,
          status: 'error',
          message: verified.message || 'Verification failed. Please complete the check and try again.'
        });
      }
    }

    var pdfBase64 = data.pdfBase64 || '';
    if (!pdfBase64 || String(pdfBase64).length < 64) {
      return jsonOut({ ok: false, status: 'error', message: 'No PDF data received in submission.' });
    }

    var clientName = data.clientName || 'Client';
    var email = data.email || '';
    var phone = data.phone || '';
    var daysRequested = data.daysRequested || '';
    var trainingDates = data.trainingDates || '';
    var fileName = data.fileName || ('Mooney_Pros_Training_Agreement_' + clientName.replace(/\s+/g, '_') + '.pdf');
    var to = TO_EMAIL;

    var pdfBytes = Utilities.base64Decode(pdfBase64);
    var blob = Utilities.newBlob(pdfBytes, 'application/pdf', fileName);

    var subject = 'Signed Training Agreement — ' + clientName;
    var body =
      'A new signed Flight Training Request & Service Agreement was submitted.\n\n' +
      'Client / Pilot: ' + clientName + '\n' +
      'Email: ' + email + '\n' +
      'Phone: ' + phone + '\n' +
      'Days requested: ' + daysRequested + '\n' +
      'Training dates: ' + trainingDates + '\n\n' +
      'The completed, signed PDF is attached.';

    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: body,
      name: FROM_NAME,
      attachments: [blob]
    });

    return jsonOut({ ok: true, status: 'success', message: 'Email sent.' });
  } catch (err) {
    return jsonOut({ ok: false, status: 'error', message: String(err && err.message ? err.message : err) });
  }
}

function getTurnstileSecret_() {
  var props = PropertiesService.getScriptProperties();
  var secret = props && props.getProperty ? props.getProperty('TURNSTILE_SECRET') : '';
  return String(secret || '').trim();
}

function honeypotFilled_(data) {
  if (!data) return false;
  var value = data.honeypot;
  if (value == null || value === '') return false;
  return String(value).trim() !== '';
}

function verifyTurnstileToken_(token, secret) {
  try {
    var res = UrlFetchApp.fetch(TURNSTILE_VERIFY_URL, {
      method: 'post',
      payload: {
        secret: secret,
        response: String(token)
      },
      muteHttpExceptions: true,
      followRedirects: true
    });
    var code = res.getResponseCode();
    var raw = res.getContentText();
    var parsed = {};
    try {
      parsed = JSON.parse(raw);
    } catch (ignore) {
      return { ok: false, message: 'Verification service returned an unreadable response. Please try again.' };
    }
    if (code >= 200 && code < 300 && parsed && parsed.success === true) {
      return { ok: true };
    }
    return { ok: false, message: 'Verification failed. Please complete the check and try again.' };
  } catch (err) {
    return { ok: false, message: 'Verification could not be completed. Please try again.' };
  }
}

function readPayload_(e) {
  var data = {};
  if (e && e.parameter) {
    Object.keys(e.parameter).forEach(function (k) { data[k] = e.parameter[k]; });
  }
  if (e && e.postData && e.postData.contents) {
    var raw = e.postData.contents;
    try {
      var parsed = JSON.parse(raw);
      Object.keys(parsed).forEach(function (k) { data[k] = parsed[k]; });
    } catch (ignore) {
      // not JSON - form-urlencoded already in e.parameter
    }
  }
  return data;
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
