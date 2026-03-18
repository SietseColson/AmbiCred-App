# `send-notification-email`

Supabase Edge Function that sends transactional emails through Resend for:

- `transaction_created`
- `transaction_approved`
- `transaction_rejected`

## Required environment variables

Set these in Supabase for the function:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `APP_BASE_URL`
- `RESEND_REPLY_TO` (optional)

## Important note about sender identity

Logging into Resend with your personal Gmail **does not mean emails are sent from that Gmail address**.

The actual sender is whatever you put in `RESEND_FROM_EMAIL`, but Resend only allows that if the sender identity is verified.

### Free testing without a domain

For first tests, you can often use:

- `RESEND_FROM_EMAIL=onboarding@resend.dev`

That is mainly useful for testing and may be restricted to your own verified email.

### Sending to friends

To reliably send to other people, you will usually need your own verified domain later, such as:

- `noreply@ambicred.app`
- `meldingen@ambicred.app`

## Example invoke payload

```json
{
  "eventType": "transaction_created",
  "transactionId": "your-transaction-uuid"
}
```
