# Bracketly accounts (v2.9.0): what to switch on in Supabase

Project: `pjbxaqaubdyjhqsfajqv`. The database side is already in place (`supabase/v7_accounts_delete.sql`).
Everything below is in the Supabase dashboard. Nothing here needs code changes except the two config flags at the end.

Until these are done, the app works exactly as before (quiet per-device sign-in). "Sign in" shows, but an email code
only arrives once email sending is set up (step 3).

1. **Keep anonymous sign-ins ON.** Go to Authentication › Sign In / Providers › "Allow anonymous sign-ins". Every device still uses one.
2. **URL configuration.** Go to Authentication › URL Configuration.
   - Site URL: `https://bracketlyapp.netlify.app` (switch it to the final domain when Bracketly moves).
   - Redirect URLs: add `https://bracketlyapp.netlify.app/**` and `https://*--bracketlyapp.netlify.app/**` (draft previews).
3. **Email codes.**
   - Authentication › Sign In / Providers › Email: Email provider ON, **Email OTP length = 6**.
   - Authentication › Emails › SMTP Settings: turn on custom SMTP (the same provider Roundly uses is fine).
     Supabase's built-in mailer only delivers to project team members, a couple of times an hour.
     Suggested sender: `Bracketly <no-reply@getbracketly.com>`.
   - Authentication › Emails › Templates: in **both** "Magic Link" and "Confirm signup", show the code. Subject: `Your Bracketly code`. Body:
     ```html
     <h2>Your Bracketly code</h2>
     <p>Enter this code in Bracketly to sign in:</p>
     <p style="font-size:28px;letter-spacing:6px;font-weight:700">{{ .Token }}</p>
     <p>It works for one hour. If you didn't ask for it, you can ignore this email.</p>
     ```
4. **Google (optional), the same as Roundly.**
   - In Google Cloud Console › APIs & Services › Credentials, create an OAuth client ID (type: Web application).
   - Authorized redirect URI: `https://pjbxaqaubdyjhqsfajqv.supabase.co/auth/v1/callback`.
   - Paste the client ID and secret into Supabase › Authentication › Sign In / Providers › Google, then turn it on.
   - In `config.js`, add `GOOGLE_SIGNIN: true`.
5. **Apple (optional).**
   - Set up a Services ID, a key and a return URL (the same callback as Google) in Apple Developer.
   - Fill in Supabase › Providers › Apple.
   - In `config.js`, add `APPLE_SIGNIN: true`.

How it fits together (the same model as Roundly):
- Each device has a quiet anonymous session.
- On sign-in (email code, Google/Apple, or a password for accounts that have one), `make_merge_token` and `claim_merge` move that device's tournaments, director role, picked name, invites and alert subscriptions into the account.
- Signing in on another device brings them all back.
- Sign out starts a fresh device session.
- "Delete my account" calls `delete_my_account`. The tournaments stay for everyone else.
