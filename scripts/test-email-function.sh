#!/usr/bin/env zsh
set -euo pipefail

: "${FUNCTION_URL:?Set FUNCTION_URL}"
: "${SUPABASE_ANON_KEY:?Set SUPABASE_ANON_KEY}"
: "${TRANSACTION_ID:?Set TRANSACTION_ID}"

curl -sS "$FUNCTION_URL" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d "{\"eventType\":\"transaction_created\",\"transactionId\":\"$TRANSACTION_ID\"}"

echo
