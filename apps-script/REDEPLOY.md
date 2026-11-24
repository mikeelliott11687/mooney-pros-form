# Redeploy Mooney Pros form Apps Script (same /exec URL)

Follow the full, ordered rollout in `docs/TURNSTILE-SETUP.md` (same text as the pull request body). The short version is below.

Do this signed in as **n9427v@gmail.com**, the account that owns the web app.

1. Open [script.google.com](https://script.google.com) as **n9427v@gmail.com**.
2. Open the project that powers
   `https://script.google.com/macros/s/AKfycby1szElrRAWz9MyqvCpE8qQob7z7fZzzDt9GXdMWvYibwRnbNZthbtPUS4YBHR2OU7edg/exec`
   (Project settings, look for that deployment ID, or check Deploy then Manage deployments).
3. Replace the contents of `Code.gs` with the file in this folder (`apps-script/Code.gs`).
4. **Deploy → Manage deployments →** pencil (Edit) on the **existing** web app deployment
   → Version: **New version** → Deploy.
   Do **not** create a new deployment (that would change the `/exec` URL).
5. Confirm Execute as: **Me** and Who has access: **Anyone**.
6. Approve the new external-request permission (UrlFetchApp) when Google asks.
7. Do **not** add the `TURNSTILE_SECRET` Script Property until the live form shows the Turnstile widget. Until that property is set, the script still accepts the current form with no token, so a script-first deploy will not break the live form.
8. After the widget is live and the secret is set, smoke-test with a TEST entry and confirm mike@ gets the email.

No browser Google sign-in from the engineering agent is allowed; this step is Mike-only.
