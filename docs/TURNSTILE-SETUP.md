# Add Cloudflare Turnstile to the Mooney Pros training form

This is a prepare-only change. The pull request is not merged. The live Apps Script deployment has not been updated. Do these steps only when you are ready, in this order, so the live form does not break.

Live form: https://mikeelliott11687.github.io/mooney-pros-form/
Embedded on: https://www.mooneypros.com/contact.html
Apps Script (keep this same /exec URL): https://script.google.com/macros/s/AKfycby1szElrRAWz9MyqvCpE8qQob7z7fZzzDt9GXdMWvYibwRnbNZthbtPUS4YBHR2OU7edg/exec
Owner account: n9427v@gmail.com

## Why this order

The new script requires a Turnstile token only after the Script Property `TURNSTILE_SECRET` is set. Until then, it still accepts the current live form (no token), still rejects a filled honeypot, and always emails mike@mooneypros.com (it ignores any client `to` field).

The form page renders the widget and blocks submit until there is a token only after you replace the placeholder `TURNSTILE_SITE_KEY` and publish the page.

So: redeploy the script first, with the secret not set yet. Publish the site key second. Add the secret last, and only after you can see the widget on the live form.

If you add the secret before the widget is live, the current form will start failing. If that happens, delete the `TURNSTILE_SECRET` Script Property. Enforcement turns off immediately. No redeploy is needed for that rollback.

## Step 1. Create a free Cloudflare account and a Turnstile widget

1. Open https://www.cloudflare.com and create a free account, or sign in if you already have one.
2. Open Turnstile in the Cloudflare dashboard: https://dash.cloudflare.com/?to=/:account/turnstile
3. Choose Add Widget.
4. Name it something clear, for example: Mooney Pros training form.
5. Under hostnames, add both:
   - www.mooneypros.com
   - mikeelliott11687.github.io
6. Widget mode: Managed is fine.
7. Create the widget and copy both values:
   - Site Key (this one is public; it goes in `index.html`)
   - Secret Key (this one stays private; it goes only in Apps Script Script Properties)
8. Do not put the Secret Key in the form file, in git, or in email if you can avoid it.

## Step 2. Redeploy the Apps Script (same /exec URL), without the secret yet

Do this signed in as n9427v@gmail.com, the account that owns the web app. Do not create a new deployment. That would change the /exec URL and break the form.

1. Open https://script.google.com as n9427v@gmail.com.
2. Open the project that powers
   https://script.google.com/macros/s/AKfycby1szElrRAWz9MyqvCpE8qQob7z7fZzzDt9GXdMWvYibwRnbNZthbtPUS4YBHR2OU7edg/exec
   (Project Settings, look for that deployment ID, or Deploy then Manage deployments).
3. Replace the contents of `Code.gs` with `apps-script/Code.gs` from this pull request.
4. Deploy, Manage deployments, pencil (Edit) on the existing web app deployment, Version: New version, Deploy.
5. Confirm Execute as: Me, and Who has access: Anyone.
6. Google will likely ask you to authorize a new permission so the script can call Cloudflare (UrlFetchApp). Approve that now. If you skip it, later token checks will fail once the secret is added.
7. Leave Script Properties alone for now. Do not add `TURNSTILE_SECRET` yet.
8. Optional check: submit a short TEST entry on the current live form (still no widget). You should still get the success message, and mike@mooneypros.com should still get the email.

## Step 3. Paste the Site Key and publish the form page

1. In `index.html`, find the clearly marked constant:

   `const TURNSTILE_SITE_KEY = 'TURNSTILE_SITE_KEY';`

2. Replace the placeholder `TURNSTILE_SITE_KEY` with your real Site Key. Do not use Cloudflare's dummy test keys on the live site.
3. Merge or publish this change so GitHub Pages updates:
   - https://mikeelliott11687.github.io/mooney-pros-form/
   - and the iframe on https://www.mooneypros.com/contact.html
4. Wait a minute, then hard-refresh both URLs.
5. Confirm the Turnstile widget is visible on the form before you go to Step 4. If you still see the form with no widget, the Site Key is not live yet. Do not add the secret.

## Step 4. Add the secret (this turns enforcement on)

1. In the same Apps Script project, open Project Settings (the gear).
2. Under Script Properties, add a property:
   - Property: `TURNSTILE_SECRET`
   - Value: your Turnstile Secret Key
3. Save. This takes effect immediately. You do not need to redeploy for the property to be picked up.

## Step 5. One test submission

1. Open https://mikeelliott11687.github.io/mooney-pros-form/ (or the contact page iframe).
2. Complete the form with a clearly labeled TEST entry (name, email, a short note that it is a test), complete the Turnstile check, and submit.
3. Confirm the form shows the usual success message and downloads a PDF copy.
4. Confirm mike@mooneypros.com received "Signed Training Agreement" with that test name and the PDF attached.
5. You can delete the test email when you are done.

## If something goes wrong

- Submissions start failing after Step 4: delete the `TURNSTILE_SECRET` Script Property. The live form will accept submissions again without a token check. Then review the Site Key and widget hostnames.
- You added the secret too early, before the widget was visible: delete `TURNSTILE_SECRET` and go back to Step 3.
- You need to undo the script itself: paste the previous `Code.gs` back and Deploy, Manage deployments, edit the existing deployment, New version. Keep the same /exec URL.
- You need to undo the published form page after a merge: `git revert` the merge commit on `main` and push (see the pull request for the exact command once it is merged). Until this PR is merged, you can simply leave it unmerged.

## What this change does not do

It does not sign up for Cloudflare for you. It does not change the live Apps Script until you follow Step 2. It does not merge this pull request. It does not add Turnstile to RegFox, Mailchimp, PayPal, or mailto links.
