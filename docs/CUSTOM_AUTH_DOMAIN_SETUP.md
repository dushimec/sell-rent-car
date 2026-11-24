# Custom Authentication Domain & Google Sign-In Branding Setup

By default, Firebase Web Authentication routes Google OAuth popups through `<project-id>.firebaseapp.com`, which causes Google's account chooser screen to display:

> "Choose an account to continue to `<project-id>.firebaseapp.com`"

Because **DCINTELIX AutoSuite** is deployed as an independent installation for each automotive dealership or rental company, each business installation should configure its own custom authentication domain and Google Cloud OAuth Consent Screen branding.

---

## 1. Per-Installation Environment Variables

Configure these environment variables for each buyer installation (see `.env.example`):

- `VITE_FIREBASE_AUTH_DOMAIN=auth.<business-domain>`
- `FIREBASE_AUTH_DOMAIN=auth.<business-domain>`
- `BUSINESS_WEBSITE_DOMAIN=www.<business-domain>`
- `VITE_FIREBASE_PROJECT_ID=<your-firebase-project-id>`
- `FIREBASE_PROJECT_ID=<your-firebase-project-id>`

You can also store `websiteDomain`, `authDomain`, `supportEmail`, `privacyPolicyUrl`, and `termsOfServiceUrl` inside **Admin Console -> Business Settings**.

> **Safety Guard:** `src/lib/firebase.ts` will only switch the runtime `auth.config.authDomain` to the stored `BusinessSetting.authDomain` once **Custom Auth Domain Verified & Active** is checked in Business Settings (or when `VITE_FIREBASE_AUTH_DOMAIN` is explicitly set). Do not enable that checkbox until Steps 2–4 below are live and SSL-provisioned.

---

## 2. Connect Custom Auth Domain in Firebase Hosting

1. Open **Firebase Console -> Hosting** (for your installation's Firebase project).
2. Click **Add custom domain** and enter your auth subdomain (`auth.<business-domain>`).
3. Add the exact DNS verification TXT record and A/CNAME records provided by Firebase Hosting at your domain registrar. *(Never guess or copy DNS target IPs from another installation.)*
4. Wait until Firebase Hosting shows **Connected** and SSL certificate status is **Active**.

---

## 3. Add Authorized Domains in Firebase Authentication

1. Open **Firebase Console -> Authentication -> Settings -> Authorized domains**.
2. Ensure all active installation domains are listed:
   - Your public website domain (e.g., `www.<business-domain>` and apex `<business-domain>`)
   - Your custom authentication domain (`auth.<business-domain>`)
   - Any active Cloud Run / preview hostname used during staging

---

## 4. Customize Google Cloud OAuth Consent Screen & Web Client

To replace the default domain and generic label on Google's account chooser screen:

1. Open **Google Cloud Console -> APIs & Services -> OAuth consent screen** for your Firebase project.
2. Set **User Type** to **External** (published to Production once ready).
3. Configure **App Information**:
   - **App name:** Your dealership/rental business name (matches Business Settings)
   - **User support email:** Your verified business support email
   - **App logo:** Square business logo (matching OAuth brand verification requirements)
4. Configure **App domain**:
   - **Application home page:** `https://<website-domain>`
   - **Application privacy policy link:** `https://<website-domain>/privacy` (or configured URL)
   - **Application terms of service link:** `https://<website-domain>/terms` (or configured URL)
5. Under **Authorized domains**, add your root domain (`<business-domain>`).
6. Open **APIs & Services -> Credentials -> Web client (auto created by Google Service)** and confirm:
   - **Authorized JavaScript origins** includes `https://<website-domain>` and `https://<auth-domain>`
   - **Authorized redirect URIs** includes `https://<auth-domain>/__/auth/handler`
7. Keep your **Google OAuth Client Secret** strictly on server-side / Google Cloud Console only — never place secrets in `VITE_*` variables or client code.

---

## 5. Verify Using AutoSuite Diagnostics

After saving your custom domain configuration, check:
- `GET /api/auth/config` — reports the active server `projectId`, `authDomain`, `usingDefaultFirebaseDomain`, and `expectedRedirectUri`.
- **Admin Console -> Business Settings -> Domain, Custom Auth & Google OAuth Branding** — displays your current runtime `authDomain`, highlights if `*.firebaseapp.com` is still active, and displays the exact handler URI for Google Cloud verification.
