import Stripe from "stripe";
import { randomBytes } from "node:crypto";
import { AppError, prices, type Principal } from "./contracts.js";
import type { Store } from "./store.js";
export class Billing {
  stripe?: Stripe;
  constructor(
    public store: Store,
    public secret?: string,
    public webhookSecret?: string,
    public dashboardOrigin = "https://aihackr.com",
  ) {
    if (secret) {
      if (!/^(sk|rk)_test_/.test(secret))
        throw new Error(
          "Only Stripe sandbox/test keys are supported until paid-beta release gates pass.",
        );
      this.stripe = new Stripe(secret);
    }
  }
  async checkout(p: Principal) {
    if (!p.owner)
      throw new AppError(
        "SCOPE_REQUIRED",
        "Only an account owner in the dashboard can purchase credits.",
        403,
      );
    if (!this.stripe || !this.webhookSecret)
      throw new AppError(
        "CAPABILITY_UNAVAILABLE",
        "Sandbox checkout is not configured.",
        503,
      );
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: prices.packCents,
            product_data: {
              name: `AIHackr ${prices.creditsPerPack} prepaid credits (sandbox)`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { tenant: p.tenant },
      success_url: `${this.dashboardOrigin}/web-data?checkout=returned`,
      cancel_url: `${this.dashboardOrigin}/web-data`,
      integration_identifier: `aihackr_${randomBytes(4).toString("hex")}`,
    });
    await this.store.db.tx((q) =>
      q.query(
        "INSERT INTO wd_payments(session,tenant,payment_intent) VALUES($1,$2,$3)",
        [
          session.id,
          p.tenant,
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
        ],
      ),
    );
    return { url: session.url, testMode: true };
  }
  async event(event: Stripe.Event) {
    if (event.livemode)
      throw new AppError(
        "TARGET_RESTRICTED",
        "Live payment events are disabled.",
        403,
      );
    await this.store.db.tx(async (q) => {
      const dup = await q.query(
        "INSERT INTO wd_webhook_events(id) VALUES($1) ON CONFLICT DO NOTHING RETURNING id",
        [event.id],
      );
      if (!dup.rows.length) return;
      if (
        [
          "checkout.session.completed",
          "checkout.session.async_payment_succeeded",
        ].includes(event.type)
      ) {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== "paid") return;
        const payment = (
          await q.query(
            "SELECT * FROM wd_payments WHERE session=$1 FOR UPDATE",
            [session.id],
          )
        ).rows[0];
        if (!payment)
          throw new AppError("INVALID_INPUT", "Unknown checkout session.");
        if (payment.granted || payment.blocked) return;
        if (
          session.amount_total !== prices.packCents ||
          session.currency !== "usd" ||
          session.metadata?.tenant !== payment.tenant
        )
          throw new AppError(
            "INVALID_INPUT",
            "Checkout amount or account mismatch.",
          );
        await q.query(
          "SELECT tenant FROM wd_wallets WHERE tenant=$1 FOR UPDATE",
          [payment.tenant],
        );
        await q.query(
          "UPDATE wd_wallets SET balance=balance+$2 WHERE tenant=$1",
          [payment.tenant, prices.creditsPerPack],
        );
        await this.store.ledger(
          q,
          payment.tenant,
          "purchase",
          prices.creditsPerPack,
          session.id,
        );
        await q.query(
          "UPDATE wd_payments SET granted=true,payment_intent=$2 WHERE session=$1",
          [session.id, session.payment_intent],
        );
      }
      if (
        event.type === "charge.refunded" ||
        event.type === "charge.dispute.created"
      ) {
        const charge = event.data.object as any;
        const intent =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;
        const payment = (
          await q.query(
            "SELECT * FROM wd_payments WHERE payment_intent=$1 FOR UPDATE",
            [intent],
          )
        ).rows[0];
        // Retrying unknown out-of-order events preserves the risk signal until the paid session is registered.
        if (!payment)
          throw new AppError(
            "UPSTREAM_FAILURE",
            "Payment mapping not yet available; retry event.",
            503,
            true,
          );
        const cents =
          event.type === "charge.refunded"
            ? charge.amount_refunded
            : prices.packCents;
        const delta = Math.max(
            0,
            Math.min(prices.packCents, cents) - payment.refunded_cents,
          ),
          credits = Math.ceil(
            (delta * prices.creditsPerPack) / prices.packCents,
          );
        await q.query(
          "UPDATE wd_wallets SET blocked=true,balance=balance-$2 WHERE tenant=$1",
          [payment.tenant, payment.granted ? credits : 0],
        );
        if (credits && payment.granted)
          await this.store.ledger(
            q,
            payment.tenant,
            "refund",
            -credits,
            event.id,
          );
        await q.query(
          "UPDATE wd_payments SET blocked=true,refunded_cents=GREATEST(refunded_cents,$2) WHERE session=$1",
          [payment.session, cents],
        );
      }
    });
  }
  async webhook(raw: Buffer, signature: string) {
    if (!this.stripe || !this.webhookSecret)
      throw new AppError(
        "CAPABILITY_UNAVAILABLE",
        "Stripe sandbox not configured.",
        503,
      );
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        raw,
        signature,
        this.webhookSecret,
      );
    } catch {
      throw new AppError("INVALID_INPUT", "Invalid webhook signature.");
    }
    await this.event(event);
    return { received: true };
  }
}
