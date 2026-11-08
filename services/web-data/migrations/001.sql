CREATE TABLE IF NOT EXISTS wd_wallets (
 tenant text PRIMARY KEY, balance integer NOT NULL DEFAULT 0, reserved integer NOT NULL DEFAULT 0 CHECK(reserved>=0),
 operation_cap integer NOT NULL DEFAULT 100, daily_cap integer NOT NULL DEFAULT 1000,
 blocked boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS wd_connections (
 tenant text NOT NULL REFERENCES wd_wallets(tenant), id text NOT NULL, scopes jsonb NOT NULL,
 operation_cap integer NOT NULL DEFAULT 50 CHECK(operation_cap>=0), daily_cap integer NOT NULL DEFAULT 200 CHECK(daily_cap>=0),
 revoked boolean NOT NULL DEFAULT false, PRIMARY KEY(tenant,id)
);
CREATE TABLE IF NOT EXISTS wd_keys (
 hash text PRIMARY KEY, tenant text NOT NULL, connection text NOT NULL, label text NOT NULL, prefix text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '90 days',
 FOREIGN KEY(tenant,connection) REFERENCES wd_connections(tenant,id)
);
CREATE TABLE IF NOT EXISTS wd_quotes (
 id text PRIMARY KEY, tenant text NOT NULL REFERENCES wd_wallets(tenant), operation text NOT NULL,
 args_hash text NOT NULL, ceiling integer NOT NULL, price_version text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS wd_jobs (
 id text PRIMARY KEY, tenant text NOT NULL REFERENCES wd_wallets(tenant), connection text NOT NULL,
 operation text NOT NULL, args jsonb NOT NULL, args_hash text NOT NULL, idempotency_key text NOT NULL,
 state text NOT NULL CHECK(state IN ('queued','running','completed','partial','failed','canceled')),
 ceiling integer NOT NULL CHECK(ceiling>=0), charged integer NOT NULL DEFAULT 0 CHECK(charged>=0 AND charged<=ceiling),
 cost_micro_usd integer NOT NULL DEFAULT 0 CHECK(cost_micro_usd>=0), cost_cap integer NOT NULL CHECK(cost_cap>=0),
 price_version text NOT NULL, cancel_requested boolean NOT NULL DEFAULT false, lease_token text, lease_until timestamptz,
 stop_reason text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant,operation,idempotency_key)
);
CREATE INDEX IF NOT EXISTS wd_jobs_queue ON wd_jobs(state,created_at);
CREATE INDEX IF NOT EXISTS wd_jobs_tenant ON wd_jobs(tenant,created_at);
CREATE TABLE IF NOT EXISTS wd_outbox (job text PRIMARY KEY REFERENCES wd_jobs(id), published_at timestamptz);
CREATE TABLE IF NOT EXISTS wd_results (
 id text PRIMARY KEY, tenant text NOT NULL REFERENCES wd_wallets(tenant), job text NOT NULL REFERENCES wd_jobs(id),
 unit text NOT NULL, body jsonb, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours', UNIQUE(job,unit)
);
CREATE INDEX IF NOT EXISTS wd_results_tenant ON wd_results(tenant,job);
CREATE TABLE IF NOT EXISTS wd_units (
 job text NOT NULL REFERENCES wd_jobs(id), unit text NOT NULL, credits integer NOT NULL CHECK(credits>=0),
 cost_micro_usd integer NOT NULL CHECK(cost_micro_usd>=0), result text NOT NULL REFERENCES wd_results(id),
 metrics jsonb NOT NULL, price_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(job,unit)
);
CREATE TABLE IF NOT EXISTS wd_events (
 id bigserial PRIMARY KEY, job text NOT NULL REFERENCES wd_jobs(id), tenant text NOT NULL, kind text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS wd_ledger (
 id bigserial PRIMARY KEY, tenant text NOT NULL REFERENCES wd_wallets(tenant), kind text NOT NULL CHECK(kind IN('grant','purchase','reserve','settle','release','refund','adjustment')),
 credits integer NOT NULL, reference text NOT NULL, price_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant,kind,reference)
);
CREATE TABLE IF NOT EXISTS wd_cache (
 tenant text NOT NULL REFERENCES wd_wallets(tenant), key text NOT NULL, body jsonb NOT NULL, observed_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, PRIMARY KEY(tenant,key)
);
CREATE TABLE IF NOT EXISTS wd_payments (
 session text PRIMARY KEY, tenant text NOT NULL REFERENCES wd_wallets(tenant), payment_intent text UNIQUE,
 granted boolean NOT NULL DEFAULT false, blocked boolean NOT NULL DEFAULT false, refunded_cents integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS wd_webhook_events (id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS wd_oauth_states (hash text PRIMARY KEY, tenant text NOT NULL REFERENCES wd_wallets(tenant), verifier text NOT NULL, nonce text NOT NULL, expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes');
CREATE TABLE IF NOT EXISTS wd_oauth_bindings (issuer text NOT NULL, subject text NOT NULL, client text NOT NULL, tenant text NOT NULL, connection text NOT NULL, PRIMARY KEY(issuer,subject,client), FOREIGN KEY(tenant,connection) REFERENCES wd_connections(tenant,id));
CREATE OR REPLACE FUNCTION wd_no_ledger_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'ledger is append-only'; END $$;
DROP TRIGGER IF EXISTS wd_ledger_immutable ON wd_ledger;
CREATE TRIGGER wd_ledger_immutable BEFORE UPDATE OR DELETE ON wd_ledger FOR EACH ROW EXECUTE FUNCTION wd_no_ledger_rewrite();
