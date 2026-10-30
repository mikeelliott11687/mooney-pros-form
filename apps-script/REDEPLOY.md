# Redeploy Mooney Pros form Apps Script (same /exec URL)

The live client already reads JSON ACKs from the current deployment
(`{"status":"error","message":"..."}` today). Redeploying this `Code.gs`
adds `{ok:true|false}` while keeping `status`, and keeps JSON + form bodies working.

## Steps (do this signed in as n9427v@gmail.com — the account that owns the web app)

1. Open [script.google.com](https://script.google.com) as **n9427v@gmail.com**.
2. Open the project that powers  
   `https://script.google.com/macros/s/AKfycby1szElrRAWz9MyqvCpE8qQob7z7fZzzDt9GXdMWvYibwRnbNZthbtPUS4YBHR2OU7edg/exec`  
   (Project settings → look for that deployment ID, or check Deploy → Manage deployments).
3. Replace the contents of `Code.gs` with the file in this folder (`apps-script/Code.gs`).
4. **Deploy → Manage deployments →** pencil (Edit) on the **existing** web app deployment  
   → Version: **New version** → Deploy.  
   Do **not** create a new deployment (that would change the `/exec` URL).
5. Confirm Execute as: **Me** and Who has access: **Anyone**.
6. Smoke-test: open the form, submit a TEST entry, confirm UI shows success and mike@ gets the email.

No browser Google sign-in from the engineering agent is allowed; this step is Mike-only.
