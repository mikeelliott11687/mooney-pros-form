/**
 * Mooney Pros — Flight Training Request form backend
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
 */
var TO_EMAIL = 'mike@mooneypros.com';
var FROM_NAME = 'Mooney Pros Training Form';

function doGet() {
  return jsonOut({ ok: true, status: 'success', message: 'Mooney Pros form endpoint is live.' });
}

function doPost(e) {
  try {
    var data = readPayload_(e);
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
    var to = data.to || TO_EMAIL;

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
      // not JSON — form-urlencoded already in e.parameter
    }
  }
  return data;
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
