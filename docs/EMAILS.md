# Transactional email

DejaWho sends two transactional emails through **Resend**, with on-brand templates authored
as **React Email** components in `server/emails/`:

| Email                                            | Trigger                                        | Code path                                                                         |
| ------------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| **Waitlist confirmation** ("you're on the list") | A visitor joins the waitlist                   | `POST /api/waitlist` → `sendWaitlistConfirmationSafe` (fire-and-forget)           |
| **Invite** ("you're in")                         | An email is inserted into `whitelisted_emails` | Supabase Database Webhook → `POST /api/internal/whitelist-webhook` → `sendInvite` |

This is the **transactional layer** only — the per-event, one-to-one sends. Deciding _who_
to invite, and _when_, stays a deliberate manual act (a batch `INSERT` into
`whitelisted_emails`). If the beta later needs drip nudges or broadcast-to-waitlist, that's a
lifecycle/marketing concern (Loops, Customer.io) layered on top — not something this code does.

## Why the invite fires on DB insert

`whitelisted_emails` is the spending/access gate. Rows land there however the operator works —
the Supabase SQL editor, the Supabase MCP, a script. A **Database Webhook** fires on the
`INSERT` regardless of source, so the invite can't be forgotten. The app never has to remember
to send it; granting access _is_ sending it.

## Architecture notes

- **`server/email.ts`** — `createEmailer(getClient)` factory bound to an injectable Resend
  client, mirroring `server/openai.ts`. The default client is lazy (constructed on first send),
  so importing the module never requires `RESEND_API_KEY` — tests and the build don't need it.
- **`server/emails/`** — `layout.tsx` (shared chrome + brand palette as literal hex, since
  email clients strip CSS variables) and the two templates. Edit copy as plain JSX.
- **`server/internal-operations.ts`** — the webhook route. Gated **only** by a shared secret
  (constant-time compared) since there's no JWT on a server-to-server call. Mounted outside the
  auth/allow-list envelope, alongside `/api/health` and `/api/waitlist`.
- Build: the server esbuild step uses `--jsx=automatic` (the project tsconfig is
  `jsx:"preserve"` for the client's Vite pipeline). Vitest sets `esbuild.jsx:"automatic"` for
  the same reason. An `.npmrc` pins `legacy-peer-deps=true` (required by `@react-email/*` peer
  ranges) so `npm install` is reproducible on Render/CI.

## Reliability: pg_net does not retry

Supabase Database Webhooks run on `pg_net`, which is **fire-and-forget — no automatic retries**.
The webhook route therefore sends the email _before_ responding, so a failure surfaces to
`pg_net` as a non-200 and is recorded in `net._http_response` (inspectable for ~6h).

The real hazard is **Render free spinning down**: a cold server can take longer to wake than the
webhook timeout, and the request is then lost with no retry. Two mitigations:

1. **Keep Render warm** with a free uptime pinger hitting `/api/health` every ~10 min
   (cron-job.org, UptimeRobot, …). Also improves first-visitor load.
2. **Resend backstop**: `npm run invite -- someone@example.com` re-sends the invite by hand. It
   does **not** touch `whitelisted_emails` — access is granted separately.

---

## Prod activation checklist

One-time setup, in order.

### 1. Resend API key

The `dejawho.io` sending domain is already verified (it backs Supabase's magic-link SMTP).
Create an **API key** in the Resend dashboard → set it as `RESEND_API_KEY` on Render.

### 2. Render environment variables

Add (Settings → Environment), then redeploy:

```
RESEND_API_KEY=<from Resend dashboard>
EMAIL_FROM=DejaWho <support@dejawho.io>    # routed for replies (Cloudflare → inbox); catch-all is off
APP_URL=https://dejawho.io                 # used in email links (invite CTA → APP_URL/sign-in)
WHITELIST_WEBHOOK_SECRET=<openssl rand -hex 32>
```

`EMAIL_FROM`, `APP_URL`, `RESEND_API_KEY`, `WHITELIST_WEBHOOK_SECRET` are read at runtime (no
rebuild needed), but the new routes require this commit to be deployed first.

### 3. Supabase Database Webhook

Create it **after** the secret is set on Render and the code is deployed (the route must exist).

**Dashboard (recommended):** Database → Webhooks → _Create a new hook_

- Table: `public.whitelisted_emails`, Events: **Insert** only
- Type: HTTP Request, Method: **POST**, URL: `https://dejawho.io/api/internal/whitelist-webhook`
- HTTP Headers: `x-webhook-secret: <same value as WHITELIST_WEBHOOK_SECRET>`
- Timeout: **5000** ms

**Or via SQL / Supabase MCP** (`<SECRET>` = the same value as `WHITELIST_WEBHOOK_SECRET`):

```sql
create trigger send_invite_on_whitelist_insert
after insert on public.whitelisted_emails
for each row
execute function supabase_functions.http_request(
  'https://dejawho.io/api/internal/whitelist-webhook',
  'POST',
  '{"Content-Type":"application/json","x-webhook-secret":"<SECRET>"}',
  '{}',
  '5000'
);
```

> The secret lives in the trigger definition (this is how the dashboard does it too) — do **not**
> commit it to a migration. Create it out-of-band via the dashboard or MCP `execute_sql`.

### 4. Keep Render warm

Point a free pinger at `https://dejawho.io/api/health` every ~10 min. See reliability note above.

### 5. Verify

- Join the waitlist on the landing page → confirmation email arrives.
- `INSERT INTO whitelisted_emails (email) VALUES ('you@example.com');` → invite email arrives.
- Inspect failures: `select * from net._http_response order by created desc limit 10;`

## Local development

Email sends are no-ops-with-a-log unless `RESEND_API_KEY` is set in `.env`. To actually send
while developing, add a real key and `EMAIL_FROM` on the verified domain. The webhook can be
exercised locally with curl:

```bash
curl -X POST localhost:5050/api/internal/whitelist-webhook \
  -H 'content-type: application/json' -H "x-webhook-secret: $WHITELIST_WEBHOOK_SECRET" \
  -d '{"type":"INSERT","table":"whitelisted_emails","record":{"email":"you@example.com"}}'
```
