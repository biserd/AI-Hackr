# AIHackr paid-plan operations

## Commercial configuration

Fixed monthly subscriptions, USD, quantity 1. Starter is $7 for 3,000 credits, Builder is $15 for 7,500, and Scale is $29 for 20,000. Verified accounts receive 1,200 free credits per UTC calendar month. Tax collection stays off. There are no monetary usage meters, automatic top-ups or overage charges.

Use the existing Big Apple Digital Stripe account `acct_1QaLCjRwvWaTf8xf` for live mode. Isolate development in a dedicated Stripe sandbox with its own catalog, portal configuration, customer data and endpoint secret. Do not modify the account's unrelated products or webhooks.

## Worker configuration

Store credentials in encrypted Cloudflare Worker secrets, separately in `aihackr` and `aihackr-browser-run-stage`:

- `STRIPE_SECRET_KEY`: a restricted runtime key. Customer read/write, Checkout Sessions read/write, Customer Portal read/write, Subscriptions read, Invoices/Invoice Payments read, Charges read, Products and Prices read. Do not grant refunds, transfers or payouts. Exact UI permission categories may differ; confirm against the runtime API calls.
- `STRIPE_WEBHOOK_SECRET`: dedicated endpoint signing secret, never another app's webhook secret.
- Keep `STRIPE_PRICES` and `STRIPE_PORTAL_CONFIGURATION` for launch-era subscriptions, invoices and any open Checkout sessions created before the price change.

Set the non-secret catalog bindings in the Worker configuration for each environment:

- `STRIPE_PRICES_V2`: JSON mapping `{ "starter": "price_…", "builder": "price_…", "scale": "price_…" }` to the current recurring prices.
- `STRIPE_PORTAL_CONFIGURATION_V2`: portal configuration for the current products.

The last two are nonsecret IDs, but encrypted secret bindings avoid accidental replacement of Dashboard-managed variables by the existing Wrangler deployment. No publishable Stripe key or browser SDK is needed for hosted redirects. Never put runtime keys, cookies or signing secrets into a package, commit, CLI argument, transcript or report.

Runtime Stripe API `2026-09-30.endive`, official Node SDK `23.0.0`, Fetch transport, async Web Crypto signature verification. Use administrative credentials only for catalog/endpoint provisioning, then retain the restricted key for runtime.

## Catalog, portal and webhook

Create one AIHackr product and one fixed monthly licensed Price per plan. Metadata: `app=aihackr`, plan slug, included credits. No automatic tax. Never reuse a different app's product.

Create a dedicated Customer Portal configuration with invoice history, payment method updates, cancellation at period end, price changes among the three AIHackr products, `proration_behavior=always_invoice`, and schedule decreasing item amounts at period end. Do not enable quantity changes. Upgrades add the net prorated credit difference from the paid adjustment invoice; renewal invoices add the full included allowance.

Live webhook: `https://aihackr.com/stripe/webhook`. Staging: the same path on the existing staging origin. Subscribe only to `BILLING_EVENTS` in `billing.mjs`: successful Checkout completion, subscription created/updated/deleted, invoice paid/payment failed, charge refunded/dispute created and early fraud warning created.

Handlers verify the raw-body signature and mode. They resolve canonical Stripe objects through the dedicated Customer ID mapping and allowlisted prices; metadata is not an ownership authority. Invoice IDs are durable grant keys. Risk events traverse Charge → PaymentIntent → InvoicePayment → Invoice → Subscription and freeze new work for review. No automatic refund or financial transfer is initiated.

Checkout redirects never grant credits. The authenticated refresh route can reconcile recent paid invoices after a delayed webhook. An existing subscription routes to the portal; one pending Checkout attempt is reused for 32 minutes. Stripe Checkout expires after 31 minutes. A different plan while an existing Checkout is open returns `CHECKOUT_PENDING` rather than creating duplicate payable sessions. Canonical completed or expired sessions are cleared before creating a later checkout, including when a former customer subscribes again after cancellation.

New subscriptions require the current policy version from an explicit dashboard checkbox. The server records the acceptance version and time before creating Checkout, attaches that version to the session/subscription metadata, and includes terms and refund links in the per-session submit message. Managing an existing subscription does not require checking the purchase consent box again. Account-wide Stripe business settings remain untouched.

## Customer policies

Static, indexable pages at `/privacy`, `/terms`, `/refunds`, `/acceptable-use`, `/cookies` and `/support` are included in the sitemap, navigation and dashboard footer. `cloudflare/policies.mjs` owns the operator contact details and policy version; `content/customer-policies.mjs` owns the public text. The operator is Big Apple Digital LLC. Support uses the existing business mailbox `hello@aitracker.com`.

The notices distinguish seven-day retrieved-content retention from longer-lived account, consent, ledger and billing-reference records. Account deletion/export requests are manual support requests. Cancellation stops subscription renewal and does not delete the account. No advertising analytics, automatic refunds, guaranteed SLA or automatic tax collection are represented. Staging shows a sandbox banner when a test-mode runtime key is installed; simulated transactions create no real purchase obligation.

## Ledger and migration

The AccountDirectory Durable Object owns atomic per-customer credit grants and holds shared across all API keys, sessions and MCP. Legacy `trialReserved` is preserved as opening spent usage, rather than issuing another free trial. Monthly buckets expire; holds stay in their original bucket across renewals, preventing rollover or use of a new period's grant to pay old work.

The BrowserWorkspace persists operation IDs, private result chunks and a settlement outbox. Customer retries with the same Idempotency-Key and body reuse results. A conflicting body returns 409. A terminal crawl is cached before settlement; alarms retry pending settlement after crashes. Partial cancelled crawls charge only successful pages with retained content. Interrupted page work and failed/no-result work release their holds. Expired unrecoverable jobs release the remaining hold, with no delivered result charged.

The provider safety budget remains 1,000 attempted pages/day across the service. It is separate from customer credits and is not refunded. This launch guard may need capacity review as paid adoption grows. Free signup and request-rate controls remain active. All plans retain the same request concurrency and crawl bounds currently advertised.

## Validation and release

Run `node --test cloudflare/test/*.test.mjs`, source verification, dependency audit and Worker compilation. Run the existing bounded staging Browser Run/MCP suite and the retained-result redeploy check.

Before recording the production gate, verify in the dedicated Stripe sandbox:

1. Sign in to a staging customer account. Create Checkout and confirm its customer, allowlisted plan, amount, return URLs, dynamic payment methods and tax-off settings. Complete using a Stripe test payment method; never use a live card.
2. Confirm a real paid invoice produces exactly one allowance through the signed webhook. Replay the event and reconcile via `/api/billing/refresh`; balance must not increase again.
3. Run one page, one extraction, a short crawl with unused capacity, and a partial cancellation. Verify available/held/used balances and ledger daily totals, including after redeployment and without client polling.
4. Open the real dedicated Customer Portal, verify invoices/cancellation/plan changes and test a paid prorated upgrade. Verify failed payment does not grant credits. Local tests separately cover old-period events, expiry, refund/dispute holds and signature tampering.
5. Check desktop/mobile dashboard, downloads, sign-in/sign-out and key ownership. Record actual evidence and limitations; screenshots with fixture data are not proof of live billing.

Store the real staging report in ignored `cloudflare/reports/billing-staging.json` with `passed`, `livemode:false`, `origin`, current `sourceDigest`, and passing evidence-backed `checks.checkout`, `paidInvoice`, `duplicateEvents`, `portal`, `creditSettlement`, `webhookSignature`. `record-gate.mjs` and production deployment refuse missing/current-source mismatched proof. Never mark these checks passed from unit tests alone.

OAuth is deferred. See the prepared package under `integrations/aihackr-plugin`; public ChatGPT linking/submission remains pending.
