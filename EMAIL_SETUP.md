# AmbiCred email setup

This project now includes a Supabase Edge Function at `supabase/functions/send-notification-email`.

## 1. Resend sender setup

### For quick self-tests
Use:

- `onboarding@resend.dev`

This is only suitable for limited testing.

### For real emails to friends
Later, verify a domain in Resend and use:

- `noreply@ambicred.app`

## 2. Required `users` table column

You already added:

- `email text`

Make sure every real user row has a valid email address.

## 3. Set Supabase Edge Function secrets

In Supabase dashboard, set these secrets:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `APP_BASE_URL`
- `RESEND_REPLY_TO` (optional)

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are used by the function runtime.

## 4. Deploy the function

Using the Supabase CLI:

```zsh
supabase functions deploy send-notification-email
```

Or deploy from the Supabase dashboard if you prefer.

## 5. What the app now sends

- On transaction creation:
  - mail to involved users
  - mail to reviewers
- On approval finalization:
  - mail to involved users
- On rejection finalization:
  - mail to involved users

## 6. Manual test

Export these locally and run the helper script:

```zsh
export FUNCTION_URL="https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-notification-email"
export SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
export TRANSACTION_ID="YOUR_TRANSACTION_UUID"
zsh ./scripts/test-email-function.sh
```

## 7. Important clarification

Your personal Gmail used to create the Resend account is only your login for the Resend dashboard.
It is **not automatically the sender address** of outgoing mails.

The sender is controlled by `RESEND_FROM_EMAIL` and must be allowed by Resend.
