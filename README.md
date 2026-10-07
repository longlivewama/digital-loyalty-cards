# Digital Loyalty Cards for Apple Wallet & Google Wallet

A digital loyalty-card platform for a coffee shop: customers get a stamp card in **Apple Wallet** or **Google Wallet**, staff scan it with a phone, and **9 stamps earn a free coffee**. Built with Next.js, TypeScript and Supabase (PostgreSQL).

<p align="center">
  <img src="docs/images/hero-wallets.webp" width="100%" alt="Digital Loyalty Cards for Apple Wallet and Google Wallet: an Apple Wallet pass and a Google Wallet card for the same coffee loyalty account, both at 6 of 9 stamps with the same member QR code">
</p>

## Overview

A customer fills in a short form and gets a personal loyalty card. They can add it to Apple Wallet (a signed `.pkpass` generated for them) or to Google Wallet (a loyalty object created through the Google Wallet API). They can also show the card's QR code from their screen. There is no app to install and no customer account.

Each card carries a QR code that identifies the customer. When staff scan it with a phone camera, a PIN-protected member page opens. There they add stamps, correct mistakes and redeem the free coffee. The database is updated first; then both wallet cards are refreshed in the background, so the stamps on the customer's phone update by themselves.

Apple Wallet and Google Wallet are **two views of the same loyalty account**. There is one customer record and one stamp balance (`members.points` in Supabase). Both wallets render that balance and carry the same QR identity. Neither wallet keeps a balance of its own.

## Wallet experience

<p align="center">
  <img src="docs/images/product-screens.webp" width="100%" alt="Four screenshots of the running app: customer signup form, wallet choice with Add to Apple Wallet, Add to Google Wallet and the member QR code, staff member page at 6 of 9 stamps, and the same page at 9 of 9 with Redeem free coffee">
</p>

These are screenshots of the running app, taken from a local build with a demo customer.

1. The customer signs up.
2. The customer picks **Add to Apple Wallet** or **Add to Google Wallet**, or keeps the member QR on screen.
3. Staff scan the QR and add stamps.
4. At **9/9** the staff page offers **Redeem free coffee**.

Both wallet cards show the same balance and the same QR code; see [Apple Wallet setup](#apple-wallet-setup) and [Google Wallet setup](#google-wallet-setup).

## Features

- **Customer signup:** an English signup form with server-side validation (`/join`).
- **QR-based customer identity:** every card encodes `<base URL>/m/<member-id>`. The QR contains no secret.
- **Apple Wallet pass:** signed per customer, with a stamp strip rendered server-side and the Apple Wallet web service for live updates.
- **Google Wallet pass:** a loyalty class and loyalty object, plus a signed "Add to Google Wallet" link.
- **Shared loyalty balance:** one balance (`members.points`) behind both wallets.
- **9 stamps = 1 free coffee.** A full card shows `9/9 · Free coffee available`.
- **Reward redemption with carry-over:** redeeming subtracts 9, so 10 stamps → redeem → 1 stamp.
- **Staff authentication:** a shop PIN, an HMAC session cookie and brute-force lockout.
- **Staff dashboard:**
  - Live stats.
  - Member list with search, sorting and filters (active, reward available, birthdays).
  - Per-member history and notes.
  - +N / −1 / redeem actions.
  - A "refresh wallet cards" action.
- **Statistics:** weekly scans, free coffees given, new members, most loyal customers, birthdays.
- **CSV export** of the customer base, protected against spreadsheet formula injection.
- **Wallet synchronization:** after each change, an APNs push for Apple and an object update for Google. Both are best-effort and never touch the stored balance.
- **Push campaigns** to Apple Wallet cards, by segment.
- **Optional Google-review nudges** after a visit.
- **Supabase / PostgreSQL:** atomic SQL functions for stamps and rewards, with row-level security enabled.
- **Responsive UI:** the customer pages and the staff member page work at phone width.

<p align="center">
  <img src="docs/images/staff-dashboard.webp" width="100%" alt="Staff dashboard showing today's scans, rewards and new members, a 7-day chart, member count, active Apple cards, return rate and coffees stamped">
</p>

## Loyalty flow

<p align="center">
  <img src="docs/images/loyalty-flow.webp" width="100%" alt="Loyalty flow in eight steps: sign up, get loyalty card, Apple or Google Wallet, show QR, staff scans, stamp added, 9 stamps, free coffee with carry-over from 10 to 1">
</p>

<details>
<summary>Text version of the flow</summary>

```
Customer signs up (/join)
        ↓
Member record created in Supabase (unique member id + card serial + secret card token)
        ↓
Customer adds the card to Apple Wallet or Google Wallet (or shows the QR on screen)
        ↓
Staff scans the QR → /m/<member-id> → staff PIN if not logged in
        ↓
Staff adds stamps (+1, or +N in one tap)
        ↓
change_points() updates members.points atomically
        ↓
Apple card (APNs push → iOS re-downloads the pass) and Google card (object PATCH) update
        ↓
9 stamps → "9/9 · Free coffee available" on the staff page and both cards
        ↓
Staff redeems → claim_reward() subtracts 9 only if the balance has at least 9
        ↓
Balance resets to 0, or keeps the extra stamps (10 → 1)
```

</details>

While a reward is waiting, cards show a full `9/9`. Extra stamps are kept and shown again once the reward is redeemed.

## Architecture

<p align="center">
  <img src="docs/images/wallet-architecture.webp" width="100%" alt="Architecture: one loyalty account with an Apple Wallet pass and a Google Wallet card, both rendered from the single Supabase row members.points, with no balance of their own">
</p>

<details>
<summary>Text version of the architecture</summary>

```
Customer / Staff phone
        |
        v
Next.js application (App Router: pages, API routes, Apple Wallet web service)
        |
        +-------------------------+
        |                         |
        v                         v
Supabase / PostgreSQL       Wallet services (best-effort, after the DB write)
        |                         |
        |                 +-------+--------+
        |                 |                |
        v                 v                v
  members.points     Apple Wallet     Google Wallet
  (the balance)      .pkpass + APNs   loyalty object
```

</details>

- **`members.points` is the single source of truth.** Every stamp, correction and redemption goes through the atomic SQL functions `change_points` and `claim_reward`.
- **Wallet passes only reflect the database:**
  - The Apple pass is regenerated from the member row whenever iOS asks for it.
  - The Google object is rewritten with the member's full current state, never with a delta, so a failed sync is repaired by the next successful one.
- **Wallet updates run after the database commit** (Next.js `after()`) and are independent of each other. An Apple or Google failure is logged and never rolls back or changes the balance.

## Technology stack

| Area | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Database | Supabase (PostgreSQL + PostgREST), `@supabase/supabase-js`, Supabase CLI for local development |
| Apple Wallet | `passkit-generator` (pass building and signing), `sharp` (stamp strip images), APNs over HTTP/2 (`node:http2`) |
| Google Wallet | `@googleapis/walletobjects` (Google Wallet API), `jsonwebtoken` (RS256 save links) |
| QR codes | `qrcode` (signup QR, member QR) |
| Testing | Node.js test runner via `tsx`, end-to-end HTTP script, local Supabase |

## Project structure

```
app/
  join/, added/[serial]/    Customer signup and wallet choice (Apple / Google / on-screen QR)
  login/, m/[id]/           Staff PIN login and the member page opened by scanning a card
  dashboard/                Staff dashboard: home, members, stats, notify, settings
  cgu/                      Terms of use
  api/join                  Signup (validation, member creation)
  api/pass/[serial]         Apple Wallet .pkpass download (signed link)
  api/google-pass/[serial]  Google Wallet save link (signed link)
  api/wallet/v1/...         Apple Wallet web service (device registration, pass updates, logs)
  api/admin/...             Staff-only API: stamps/redeem, settings, broadcast, CSV export
  api/auth, api/cron        Staff login/logout, review-nudge cron
  _components/              Member actions, stamp grid, birthday field
lib/
  loyalty.ts                Loyalty rules (goal 9, cycle, rewards, display)
  members.ts                Stamp/redeem operations + post-commit wallet sync
  pass.ts, stampStrip.ts    Apple pass content, signing, stamp strip rendering
  apns.ts, cardAuth.ts      APNs push, per-card Apple authentication tokens
  googleWallet.ts           Google Wallet class/object, sync, save-link JWT
  linkSign.ts               HMAC-signed customer links and staff session cookie
  settings.ts, events.ts, broadcast.ts, reviews.ts, birthday.ts, supabase.ts, url.ts
middleware.ts               Protects /m, /dashboard and /api/admin
supabase/                   Supabase CLI config + migrations (the schema)
tests/                      Unit tests; tests/db/ = database-backed tests
scripts/                    e2e.mjs (HTTP end-to-end), dev-certs.sh (test certs), make-assets.mjs (artwork)
pass-model/                 Apple pass images (generated placeholder artwork)
public/                     Site / Google Wallet logo
docs/images/                README visuals (screenshots + mockups rendered from the app's pass data)
MIGRATION-*.sql             Original SQL files + MIGRATION-COFFEE-GOOGLE-WALLET.sql for existing databases
pass-sample.pass/, sign.sh  Hand-built sample pass and manual signing script (prototyping)
```

## Local development

Requirements: Node.js 20+ (tested with Node 24), npm and Docker (for the local Supabase).

```bash
npm install
npm run db:start                  # local Supabase in Docker; applies supabase/migrations
cp .env.example .env.local        # then fill it in (see below)
npm run certs:dev >> .env.local   # optional: TEST-ONLY Apple certificates (see Apple Wallet setup)
npm run dev                       # http://localhost:3000  (or: npm run dev -- -p 3100)
```

The minimum `.env.local` for local development:

```bash
SUPABASE_URL=http://127.0.0.1:55621
SUPABASE_SERVICE_ROLE_KEY=<local Supabase secret key>
MERCHANT_PIN=<6-digit staff PIN>
APP_SECRET=<openssl rand -hex 32>
CRON_SECRET=<openssl rand -hex 16>
```

About the local Supabase:

- **Ports.** `supabase/config.toml` runs it on ports **55620–55629**, so it doesn't clash with another local Supabase on the default 543xx ports.
- **Services.** Only Postgres, PostgREST and the API gateway run; Auth, Storage, Realtime and Studio are disabled because the app doesn't use them.
- **The service key.** The Supabase CLI uses a fixed, public default secret key (`sb_secret_N7UND…`) for every local stack. It only works against your own local instance. Because Auth is disabled here, `npx supabase status` doesn't print it; take the full value from the Supabase CLI local-development docs.
- **Database URL:** `postgresql://postgres:postgres@127.0.0.1:55622/postgres`.

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests |
| `npm run test:db` | Database-backed tests (needs `npm run db:start` and `.env.local`) |
| `npm run e2e` | End-to-end HTTP tests against a running server (`BASE=http://localhost:3100 npm run e2e`) |
| `npm run db:start` / `db:stop` / `db:reset` | Local Supabase; `db:reset` re-applies all migrations (wipes local data) |
| `npm run certs:dev` | Prints self-signed, test-only Apple signing values |
| `npm run assets` | Regenerates the placeholder card artwork |

Pages: `/` (counter QR), `/join`, `/login`, `/dashboard`, `/dashboard/members`, `/dashboard/stats`, `/dashboard/settings`, `/dashboard/notify`, `/m/<member-id>`.

## Environment variables

All variables are listed in [`.env.example`](.env.example), with placeholders only. Every secret is server-side; the only `NEXT_PUBLIC_` variable is the public base URL.

**Supabase**

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only secret (service-role) key; never sent to the browser |

**Application**

| Variable | Purpose |
|---|---|
| `MERCHANT_PIN` | Staff PIN for the dashboard and member pages |
| `APP_SECRET` | HMAC key for signed customer links and the staff session cookie |
| `CRON_SECRET` | Bearer token required by `/api/cron/review-nudge` |
| `NEXT_PUBLIC_BASE_URL` | Public HTTPS origin, used in QR codes, the Apple web-service URL and the Google logo URL. Leave it empty locally. |
| `SHOP_LATITUDE`, `SHOP_LONGITUDE` | Optional; show the Apple pass on the lock screen near the shop |

**Apple Wallet**

| Variable | Purpose |
|---|---|
| `PASS_TYPE_ID` | Pass Type ID, e.g. `pass.com.yourshop.loyalty` (also the APNs topic) |
| `TEAM_ID` | Apple Developer Team ID |
| `PASS_SIGNER_CERT` | Pass Type ID certificate, PEM, base64-encoded on one line |
| `PASS_SIGNER_KEY` | Its private key, unencrypted PEM, base64-encoded on one line (no passphrase variable is supported) |
| `PASS_WWDR` | Apple WWDR G4 certificate, PEM, base64-encoded |

APNs needs no extra variables: pushes reuse the Pass Type ID certificate and key.

**Google Wallet**

| Variable | Purpose |
|---|---|
| `WALLET_ISSUER_ID` | Issuer ID from the Google Pay & Wallet Console (required) |
| `CLIENT_EMAIL`, `PRIVATE_KEY` | Service-account email and private key (required; keep the `\n` escapes on one line) |
| `TYPE`, `PROJECT_ID`, `PRIVATE_KEY_ID`, `CLIENT_ID`, `AUTH_URI`, `TOKEN_URI`, `AUTH_PROVIDER_X509_CERT_URL`, `CLIENT_X509_CERT_URL`, `UNIVERSE_DOMAIN` | The remaining service-account JSON fields |
| `GOOGLE_WALLET_CLASS_SUFFIX` | Loyalty class id suffix (default `coffee_loyalty`) |
| `GOOGLE_WALLET_LOGO_URL` | Optional public HTTPS logo; default `<base URL>/logo.png` |

If the Apple or Google variables are missing, that wallet's button is hidden and its endpoint returns a clear 503. The rest of the app keeps working.

## Apple Wallet setup

<p align="center">
  <img src="docs/images/apple-wallet.webp" width="100%" alt="Apple Wallet digital coffee loyalty card: the Add to Apple Wallet button, then a pass mockup at 6 of 9 stamps, then the same pass at 9 of 9 showing Free coffee">
</p>

<sub>The pass images are mockups rendered from the fields, stamp strip and QR code that <code>lib/pass.ts</code> produces, using demo data. They are not screenshots from a device: installation on a real iPhone hasn't been verified yet (see <a href="#testing-and-qa">Testing and QA</a>).</sub>

1. An **Apple Developer account**, with a **Pass Type ID** (`PASS_TYPE_ID`) and your **Team ID** (`TEAM_ID`).
2. Create the Pass Type ID **certificate**, export it as `.p12`, and split it into PEM files:
   ```bash
   openssl pkcs12 -in Certificates.p12 -clcerts -nokeys -out certs/signerCert.pem -legacy
   openssl pkcs12 -in Certificates.p12 -nocerts -nodes -out certs/signerKey.pem -legacy
   ```
3. Download Apple's **WWDR G4** intermediate certificate as PEM (`certs/wwdr.pem`).
4. Base64-encode each PEM on one line, e.g. `base64 -i certs/signerCert.pem | tr -d '\n'`, into `PASS_SIGNER_CERT`, `PASS_SIGNER_KEY` and `PASS_WWDR`. `certs/`, `*.pem` and `*.p12` are gitignored.

How it works:

- `lib/pass.ts` builds and signs one pass per member. `/api/pass/<serial>?k=…` serves it.
- Each pass declares the web service `<base URL>/api/wallet`. iOS registers the device there (authenticated with the card's secret token, `lib/cardAuth.ts`).
- After a stamp change, `lib/apns.ts` sends an APNs push; iOS then downloads the updated pass.
- **HTTPS is required.** iOS only talks to the web service over public HTTPS, so set `NEXT_PUBLIC_BASE_URL` to your deployment or to a tunnel.

**Local testing vs production.** `npm run certs:dev` generates **self-signed test certificates**. They exercise the whole generation and signing path, and the tests verify the signature with OpenSSL, but **iPhones reject these passes** and they are **not production credentials**. No certificates or keys are committed to this repository.

## Google Wallet setup

<p align="center">
  <img src="docs/images/google-wallet.webp" width="100%" alt="Google Wallet digital coffee loyalty card: the Add to Google Wallet button, then a loyalty card mockup at 6 of 9 stamps, then the synced card at 9 of 9 with Free coffee available">
</p>

<sub>The card images are mockups rendered from the loyalty class and object that <code>lib/googleWallet.ts</code> builds, using demo data. The real Google Wallet save flow hasn't been verified with a production issuer account yet (see <a href="#testing-and-qa">Testing and QA</a>).</sub>

1. In the **Google Pay & Wallet Console**, create an issuer account → `WALLET_ISSUER_ID`.
2. In **Google Cloud**, enable the **Google Wallet API**, create a **service account** and download its JSON key. Copy its fields into the variables above; don't commit the JSON file.
3. In the Wallet Console, give the service account access to the issuer.
4. While the issuer is in demo mode, only **test accounts** added in the console can save passes.
5. Google downloads the program logo, so it must be a public HTTPS image.

How it works (`lib/googleWallet.ts`, adapted from Google's Wallet REST samples):

- **Class.** One loyalty class, `<issuer>.coffee_loyalty`, holds the shop name, logo, rules, hours and address. It is created automatically and re-patched when settings are saved.
- **Object.** Each member gets one loyalty object, `<issuer>.member_<member-uuid>`. It shows stamps (`6/9`), free coffees available, progress text and the **same QR value** as the Apple pass. Its id is stored in `members.google_object_id`, which links the Google card to the Supabase member.
- **Save flow.** `/api/google-pass/<serial>?k=…` creates or updates the class and object, then redirects to a freshly signed `https://pay.google.com/gp/v/save/<JWT>` link. If the Google API is unavailable, the JWT embeds the object so the card can still be saved.
- **Updates.** After each stamp change, the object is rewritten from the current database state.

## Database

The schema lives in `supabase/migrations/`:

- **`20260101000000_baseline.sql`**: the original schema plus three columns the code always needed (`phone`, `total_earned`, `updated_at`).
- **`20261007000000_coffee_google_wallet.sql`**: `google_object_id`, goal 9, coffee settings.
- **`20261008000000_restrict_stamp_functions.sql`**: stamp functions callable by the service role only.

For an existing database, `MIGRATION-COFFEE-GOOGLE-WALLET.sql` applies the same changes idempotently.

| Table | Contents |
|---|---|
| `members` | One row per customer: `id` (uuid, the QR identity), `serial`, names, birthday, phone, **`points` (the loyalty balance, single source of truth)**, `total_earned` (coffees bought), `auth_token` / `token_rotated` (Apple card auth), `device_lib_id` / `push_token` / `registered_at` (Apple device), `google_object_id`, `push_msg` (campaign message), review-nudge fields, `note`, `created_at` / `updated_at` |
| `events` | Log of `signup` / `add` / `remove` / `claim` with deltas (history, stats) |
| `settings` | Single row: shop name, address, phone, hours, Instagram, **`goal` = 9**, review-nudge settings |
| `campaigns` | Sent push campaigns |
| `login_attempts` | Failed staff PIN attempts per IP (lockout) |

**SQL functions**

- `change_points(p_id, p_delta, p_earned)`: atomic add or remove. The balance never goes below 0.
- `claim_reward(p_id, p_goal)`: atomic redeem. It subtracts the goal only if `points >= goal`, which prevents double redemption.

**Access**

- **Row-level security** is enabled on every table, with no public policies.
- The app only talks to the database from the server, with the service-role key.
- `EXECUTE` on both functions is revoked from `anon` and `authenticated`.

The staff "account" is the shared `MERCHANT_PIN`; there is no staff user table.

## Security

These protections are implemented and were exercised during QA. This is a description of measures, not a security certification.

- **Signed customer links.** `/added`, the Apple pass download, the Google save link and the registration-status endpoint require `?k=<HMAC(serial)>` (`APP_SECRET`). A card serial alone can't download someone's pass or its Wallet token.
- **Staff session.** The `mpin` cookie is an HMAC of the PIN, never the PIN itself. It is HttpOnly, SameSite=Lax and Secure in production. After 5 wrong PINs, the IP is locked out for 15 minutes.
- **Route protection.** Middleware protects `/m/*`, `/dashboard/*` and `/api/admin/*`.
- **Open-redirect protection** on the login `next` parameter.
- **Server-side input validation** at signup (required names, length limits, valid birthday and phone) and on staff actions (valid member id, known operation, positive integer quantity).
- **Atomic loyalty operations in SQL.** Concurrent requests can't lose stamps, redeem twice or go negative.
- **Database access.** RLS is on, the service-role key stays on the server, and the stamp RPCs can't be called with the public key.
- **Apple web service:** per-card secret tokens with soft rotation away from the original guessable token.
- **CSV export:** values starting with `= + - @` are neutralised against formula injection.
- **Customer-controlled text** is rendered escaped by React.
- **Secrets:** `.env*.local`, certificates, keys and service-account JSON are gitignored. Wallet libraries are server-only, and the build output was checked for leaked secrets.

## Testing and QA

Latest local QA run (Next.js production build, local Supabase):

```
Unit tests:            23/23 PASS
Database tests:         6/6  PASS
E2E tests:             83/83 PASS
Fake Google E2E:       85/85 PASS   (fake service account; Google's real token endpoint rejects it → graceful fallback)
Build:                       PASS
Typecheck:                   PASS
Browser QA:                  PASS   (signup, staff login/logout, 0/9 → 9/9 → redeem → 0/9, dashboard, phone width)
Concurrency / security:      PASS
Concurrency stress:          150 mixed concurrent requests (+1, −1, redeem): balance, event log and total_earned consistent
```

What the suites cover:

- **Unit tests:** the loyalty rules; Apple pass content, plus real `.pkpass` signing verified with OpenSSL; the Google class, object and save-link JWT, and error handling against a mocked Google API; link signing.
- **Database tests:** atomic stamps, races, redemption, and Google sync against the real database with a mocked Google API.
- **E2E tests:** signup and validation, signed links, Apple pass download, the Apple web-service endpoints, staff auth and lockout, the stamp/reward/redeem flow, dashboard pages, CSV export, and database permissions.

**Not verified** (requires real credentials, devices or a deployment):

- Installing a pass in Apple Wallet on a real iPhone.
- Real Apple Push Notification delivery.
- A real Google Wallet issuer account and the production "Save to Google Wallet" flow on Android.
- A production HTTPS deployment behind a real proxy.

## Known limitations

- The items listed under **Not verified** above.
- Signing up twice creates two separate cards (no de-duplication).
- The tracked review link `/r/<member-id>` is public. Anyone who knows a member id can mark that member as "reviewed"; the worst case is that member stops getting review reminders.
- The PIN lockout keys on `x-forwarded-for`. That's reliable behind platforms that set it (e.g. Vercel) but can be spoofed on a self-hosted server without a trusted proxy.
- Push campaigns and review nudges are delivered through APNs, so only Apple cards receive them. Google cards show the message on their next update.
- One Apple device per member (a single `push_token` column).
- Some internal code comments, and the historical planning docs (`MVP.md`, `DASHBOARD-SPEC.md`, …, each marked as historical), are in French. They are not customer-facing.
- The artwork (`pass-model/`, `public/logo.png`) is generated placeholder art. Replace it with real branding.

## Deployment

This project has **not** been deployed to production. A real deployment needs:

- A production **Supabase** project with the migrations applied (`npx supabase link` + `npx supabase db push`). Optionally, the pg_cron schedule from `MIGRATION-REVIEWS.sql` for review nudges.
- **Next.js hosting** (e.g. Vercel, which `vercel.json` targets) on **HTTPS**, with `NEXT_PUBLIC_BASE_URL` set to that origin.
- Production **environment variables** in the host's secret manager: Supabase keys, `MERCHANT_PIN`, `APP_SECRET`, `CRON_SECRET`.
- **Apple Wallet** production credentials: Pass Type ID certificate, key and WWDR. APNs uses the same certificate.
- **Google Wallet:** an issuer account with publishing access, and a service account with Wallet API access.
- Real artwork, and terms of use reviewed for your business and jurisdiction.

## License and attribution

This project builds on [wallet-loyalty](https://github.com/romainsildev/wallet-loyalty) by Romain, released under the **MIT License**. Its original copyright notice is kept in [`LICENSE`](LICENSE) and applies to this repository.

The Google Wallet integration in `lib/googleWallet.ts` is adapted from [google-wallet-passes](https://github.com/RaimundoDiaz/google-wallet-passes) (MIT), which is itself based on Google's Wallet REST samples (Apache License 2.0); attribution is kept in that file's header.
