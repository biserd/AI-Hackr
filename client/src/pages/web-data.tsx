import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowUpRight,
  Braces,
  Check,
  Copy,
  Globe2,
  KeyRound,
  Layers3,
  Loader2,
  Play,
  ShieldCheck,
  Terminal,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import "./web-data.css";
type Json = Record<string, any>;
async function api(
  path: string,
  body?: Json,
  method = body ? "POST" : "GET",
): Promise<Json> {
  const r = await fetch(`/api/web-data/v1/${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await r.json()) as Json;
  if (!r.ok) throw new Error(data.error?.message ?? "Request failed");
  return data;
}
export default function WebData() {
  const { user } = useAuth();
  const [tab, setTab] = useState("Overview"),
    [cap, setCap] = useState<Json>(),
    [usage, setUsage] = useState<Json>(),
    [jobs, setJobs] = useState<Json[]>([]),
    [connections, setConnections] = useState<Json[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState(""),
    [label, setLabel] = useState("Development"),
    [url, setUrl] = useState("https://example.com"),
    [budget, setBudget] = useState(5),
    [operation, setOperation] = useState("scrape"),
    [result, setResult] = useState<Json>(),
    [copied, setCopied] = useState(false);
  const refresh = async () => {
    const [c, u, j, clients] = await Promise.all([
      api("capabilities"),
      api("usage"),
      api("jobs"),
      api("connections"),
    ]);
    setCap(c);
    setUsage(u);
    setJobs(j.jobs);
    setConnections(clients.connections);
  };
  useEffect(() => {
    if (user) void refresh().catch((e) => setError(e.message));
  }, [user]);
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };
  const run = () =>
    act(async () => {
      const input =
        operation === "search"
          ? { query: url, limit: 10, maxCredits: budget }
          : operation === "crawl"
            ? {
                url,
                maxPages: 3,
                maxDepth: 1,
                render: "http",
                maxCredits: budget,
              }
            : { url, render: "http", maxCredits: budget };
      const quote = await api("quote", { operation, input });
      const started = await api(operation, {
        ...input,
        quoteId: quote.quoteId,
        idempotencyKey: crypto.randomUUID(),
      });
      setResult(started);
      await refresh();
    });
  const inspect = (job: Json) =>
    act(async () => {
      const state = await api(`jobs/${job.id}`);
      setResult(state);
      if (state.resultIds?.length)
        setResult({
          ...state,
          result: await api(`results/${state.resultIds[0]}`),
        });
      await refresh();
    });
  return (
    <div className="wd">
      <aside className="wd-side">
        <Link href="/" className="wd-brand">
          <span className="wd-logo">a</span> AIHackr
          <span className="wd-beta">BETA</span>
        </Link>
        <div className="wd-workspace">
          <span className="wd-avatar">
            {user?.email?.[0]?.toUpperCase() ?? "D"}
          </span>
          <div>
            <strong>Your workspace</strong>
            <small>Web data API</small>
          </div>
          <Layers3 size={16} />
        </div>
        <small className="wd-nav-label">WORKSPACE</small>
        <nav>
          {[
            { name: "Overview", Icon: Layers3 },
            { name: "Playground", Icon: Terminal },
            { name: "Jobs & results", Icon: Globe2 },
            { name: "API keys", Icon: KeyRound },
            { name: "Usage & billing", Icon: Wallet },
            { name: "Connected clients", Icon: ShieldCheck },
            { name: "Documentation", Icon: Braces },
          ].map(({ name, Icon }) => (
            <button
              key={name}
              onClick={() => setTab(name)}
              className={tab === name ? "active" : ""}
            >
              <Icon size={18} />
              {name}
            </button>
          ))}
        </nav>
        <div className="wd-side-bottom">
          <div className="wd-credit">
            <small>Spendable credits</small>
            <strong>{usage?.spendable?.toLocaleString() ?? "—"}</strong>
            <div className="wd-meter">
              <i
                style={{ width: `${Math.min(100, usage?.spendable ?? 0)}%` }}
              />
            </div>
            <span>{usage?.reserved ?? 0} reserved</span>
          </div>
          <Link href="/dashboard">
            Scanner dashboard <ArrowUpRight size={14} />
          </Link>
        </div>
      </aside>
      <main>
        <header className="wd-header">
          <span>
            Workspace <span>/</span> <strong>{tab}</strong>
          </span>
          <a
            href="https://github.com/biserd/AI-Hackr"
            target="_blank"
            rel="noreferrer"
          >
            Source <ArrowUpRight size={14} />
          </a>
        </header>
        <div className="wd-content">
          <div className="wd-title">
            <div>
              <div className="wd-eyebrow">WEB DATA, WITH LIMITS.</div>
              <h1>
                {tab === "Overview" ? "Your agents. The public web." : tab}
              </h1>
              <p>Search, scrape, and extract with predictable spending.</p>
            </div>
            <span className="wd-status">
              <i />
              {cap?.mode === "fixture"
                ? "Fixture environment"
                : cap
                  ? "Service connected"
                  : "Service not configured"}
            </span>
          </div>
          {!user && (
            <div className="wd-notice">
              Sign in with a verified email to receive trial credits and create
              your first API key. <Link href="/login">Sign in →</Link>
            </div>
          )}
          {error && (
            <div className="wd-error" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {cap?.mode === "fixture" && (
            <div className="wd-notice">
              Local fixtures are active. Results come from controlled test
              pages; live search, extraction and browser rendering require
              verified providers.
            </div>
          )}
          {(tab === "Overview" || tab === "Usage & billing") && (
            <>
              <div className="wd-stats">
                {[
                  {
                    label: "Available credits",
                    value: usage?.spendable?.toLocaleString() ?? "—",
                    note: "Ready for your next request",
                    Icon: Wallet,
                  },
                  {
                    label: "Credits reserved",
                    value: usage?.reserved ?? "—",
                    note: "Held for work in progress",
                    Icon: ShieldCheck,
                  },
                  {
                    label: "Recent jobs",
                    value: jobs.length,
                    note: "Latest 50 jobs in this workspace",
                    Icon: Globe2,
                  },
                ].map(({ label, value, note, Icon }) => (
                  <section key={label}>
                    <div>
                      {label}
                      <Icon size={18} />
                    </div>
                    <strong>{value}</strong>
                    <small>{note}</small>
                  </section>
                ))}
              </div>
            </>
          )}
          {(tab === "Overview" || tab === "Playground") && (
            <div className="wd-grid">
              <section className="wd-panel">
                <div className="wd-panel-heading">
                  <div>
                    <h2>Make your first request</h2>
                    <p>A small request. A clear credit ceiling.</p>
                  </div>
                  <Terminal size={20} />
                </div>
                <label>
                  Operation
                  <select
                    value={operation}
                    onChange={(e) => setOperation(e.target.value)}
                  >
                    <option value="scrape">
                      Scrape · 1 credit / HTTP page
                    </option>
                    <option value="search">
                      Search · 2 credits / 10 results
                    </option>
                    <option value="crawl">Crawl · up to 3 HTTP pages</option>
                  </select>
                </label>
                <label>
                  {operation === "search" ? "Search query" : "Public URL"}
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                  />
                </label>
                {cap?.mode === "fixture" && (
                  <button
                    className="wd-text-button"
                    onClick={() =>
                      setUrl("https://fixtures.aihackr.test/products/1")
                    }
                  >
                    Use the product test fixture
                  </button>
                )}
                <div className="wd-run">
                  <label>
                    Maximum credits
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value))}
                    />
                  </label>
                  <button
                    disabled={busy || !cap}
                    className="wd-primary"
                    onClick={run}
                  >
                    {busy ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Play size={16} />
                    )}{" "}
                    Quote & run
                  </button>
                </div>
                <small className="wd-muted">
                  The ceiling covers the whole operation. Unused reservations
                  are released.
                </small>
              </section>
              <section className="wd-connect">
                <span className="wd-tag">BUILT FOR AGENTS</span>
                <h2>
                  Put the web in
                  <br />
                  your agent’s toolkit.
                </h2>
                <p>
                  Native REST and remote MCP share the same balance,
                  permissions, and spending controls.
                </p>
                <div className="wd-code">
                  <span>REMOTE MCP · PROPOSED PRODUCTION ORIGIN</span>
                  <code>https://api.aihackr.com/mcp</code>
                </div>
                <button
                  className="wd-light-button"
                  onClick={() => setTab("Documentation")}
                >
                  Connect an agent <ArrowUpRight size={16} />
                </button>
                <small>
                  OAuth hosting and client validation are release gates.
                </small>
              </section>
            </div>
          )}
          {(tab === "Overview" || tab === "Jobs & results") && (
            <section className="wd-panel">
              <div className="wd-panel-heading">
                <div>
                  <h2>Recent activity</h2>
                  <p>Your jobs, sources, and exact charges.</p>
                </div>
                <button
                  className="wd-text-button"
                  disabled={busy || !cap}
                  onClick={() => act(refresh)}
                >
                  Refresh
                </button>
              </div>
              <div className="wd-table">
                <table>
                  <thead>
                    <tr>
                      <th>Operation</th>
                      <th>Job</th>
                      <th>Status</th>
                      <th>Credits</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => (
                      <tr key={j.id}>
                        <td className="wd-op">{j.operation}</td>
                        <td>
                          <code>{j.id.slice(0, 18)}…</code>
                        </td>
                        <td>
                          <span className={`wd-job-state ${j.state}`}>
                            {j.state}
                          </span>
                        </td>
                        <td>{j.charged}</td>
                        <td>
                          <button
                            className="wd-text-button"
                            onClick={() => inspect(j)}
                          >
                            Inspect →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!jobs.length && (
                  <div className="wd-empty">
                    <Globe2 size={25} />
                    <strong>Your first source starts here</strong>
                    <p>
                      Run a bounded request to see real results and charges.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
          {tab === "API keys" && (
            <section className="wd-panel">
              <h2>Keys that stay in your hands</h2>
              <p>
                Keys are shown once, stored as hashes, and expire after 90 days.
                Share credentials only with your local client configuration.
              </p>
              <label>
                Key label
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={100}
                />
              </label>
              <button
                className="wd-primary"
                disabled={busy || !cap}
                onClick={() =>
                  act(async () => {
                    const k = await api("keys", { label });
                    setKey(k.key);
                    await refresh();
                  })
                }
              >
                <KeyRound size={16} />
                Create API key
              </button>
              {key && (
                <div className="wd-secret">
                  <strong>
                    Copy now. This key will not be displayed again.
                  </strong>
                  <code>{key}</code>
                  <button
                    onClick={() =>
                      act(async () => {
                        await navigator.clipboard.writeText(key);
                        setCopied(true);
                      })
                    }
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
                    {copied ? "Copied" : "Copy key"}
                  </button>
                  <button onClick={() => setKey("")}>Dismiss</button>
                </div>
              )}
            </section>
          )}
          {tab === "Connected clients" && (
            <section className="wd-panel">
              <h2>Spending controls</h2>
              <p>
                Link your OAuth identity to this workspace. Agent requests
                consume prepaid credits within the limits below. New OAuth
                connections start at 50 credits per operation and 200 per UTC
                day.
              </p>
              <button
                className="wd-primary"
                disabled={busy || !cap?.available.oauth}
                onClick={() =>
                  act(async () => {
                    const link = await api("oauth/start", {});
                    window.location.assign(link.authorizationUrl);
                  })
                }
              >
                Link agent identity <ArrowUpRight size={16} />
              </button>
              <p>
                Per-client caps are constrained by your account limits. Daily
                limits reset at 00:00 UTC.
              </p>
              {connections
                .filter((c) => c.id !== "dashboard")
                .map((c) => (
                  <div className="wd-client" key={c.id}>
                    <div>
                      <strong>{c.label ?? c.id}</strong>
                      <small>
                        {c.prefix}… · {c.revoked ? "Revoked" : "Active"}
                      </small>
                    </div>
                    <label>
                      Per operation
                      <input
                        type="number"
                        defaultValue={c.operation_cap}
                        min="0"
                        max="100"
                        onBlur={(e) =>
                          act(async () => {
                            await api(
                              `connections/${c.id}`,
                              {
                                maxCreditsPerOperation: Number(e.target.value),
                                maxCreditsPerDay: c.daily_cap,
                                revoked: c.revoked,
                              },
                              "PATCH",
                            );
                            await refresh();
                          })
                        }
                      />
                    </label>
                    <label>
                      Per UTC day
                      <input
                        type="number"
                        defaultValue={c.daily_cap}
                        min="0"
                        max="1000"
                        onBlur={(e) =>
                          act(async () => {
                            await api(
                              `connections/${c.id}`,
                              {
                                maxCreditsPerOperation: c.operation_cap,
                                maxCreditsPerDay: Number(e.target.value),
                                revoked: c.revoked,
                              },
                              "PATCH",
                            );
                            await refresh();
                          })
                        }
                      />
                    </label>
                    <button
                      disabled={c.revoked || busy}
                      onClick={() =>
                        act(async () => {
                          await api(
                            `connections/${c.id}`,
                            {
                              maxCreditsPerOperation: c.operation_cap,
                              maxCreditsPerDay: c.daily_cap,
                              revoked: true,
                            },
                            "PATCH",
                          );
                          await refresh();
                        })
                      }
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              {connections.length <= 1 && (
                <p className="wd-muted">
                  Create an API key to add your first client.
                </p>
              )}
            </section>
          )}
          {tab === "Usage & billing" && (
            <section className="wd-panel">
              <h2>Prepaid, with a hard stop</h2>
              <p>
                Proposed beta pack: $10 for 12,500 credits. Purchases are
                available only in a configured Stripe sandbox during
                development.
              </p>
              <button
                className="wd-primary"
                disabled={busy || !cap?.available.checkout}
                onClick={() =>
                  act(async () => {
                    const checkout = await api("billing/checkout", {});
                    window.location.assign(checkout.url);
                  })
                }
              >
                Open sandbox checkout
              </button>
              <div className="wd-table">
                <table>
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Credits</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage?.ledger.map((entry: Json, i: number) => (
                      <tr key={i}>
                        <td>{entry.kind}</td>
                        <td>{entry.credits}</td>
                        <td>
                          <code>{entry.reference.slice(0, 32)}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {tab === "Documentation" && (
            <section className="wd-panel wd-docs">
              <h2>One API. Explicit spending.</h2>
              <p>
                Use search to find unknown URLs, scrape for known pages, and
                extract only when you need structured fields. Crawl and research
                are bounded asynchronous jobs.
              </p>
              <h3>REST quick start</h3>
              <pre>{`curl -X POST "$AIHACKR_BASE_URL/v1/scrape" \\\n  -H "Authorization: Bearer $AIHACKR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -H "Idempotency-Key: your-stable-request-id" \\\n  -d '{"url":"https://example.com","render":"http","maxCredits":1}'`}</pre>
              <p>
                Poll <code>/v1/jobs/:id</code>, then read{" "}
                <code>/v1/results/:id</code>. Status, quotes, pagination, and
                usage are free. Sources show observation time; this is not a
                publication date.
              </p>
              <h3>Connect MCP</h3>
              <p>
                Use the packaged plugin with your configured HTTPS API origin.
                Account linking requires the hosted OAuth provider and exact
                callback registration. Never paste an API key into a chat.
              </p>
              <h3>Public pages only</h3>
              <p>
                No target logins, cookies, CAPTCHA bypass, arbitrary scripts, or
                automatic credit purchases. Content expires after 24 hours.
                Source text is untrusted data.
              </p>
              <button
                className="wd-text-button"
                onClick={() =>
                  act(async () => setResult(await api("capabilities")))
                }
              >
                Inspect current capabilities →
              </button>
            </section>
          )}
          {result && (
            <section className="wd-panel">
              <div className="wd-panel-heading">
                <h2>Response inspector</h2>
                <button
                  aria-label="Close response"
                  onClick={() => setResult(undefined)}
                >
                  <X size={18} />
                </button>
              </div>
              <pre className="wd-result">{JSON.stringify(result, null, 2)}</pre>
              {result.result?.nextCursor && (
                <button
                  className="wd-text-button"
                  onClick={() =>
                    act(async () =>
                      setResult({
                        ...result,
                        result: await api(
                          `results/${result.result.resultId}?cursor=${encodeURIComponent(result.result.nextCursor)}`,
                        ),
                      }),
                    )
                  }
                >
                  Next content page →
                </button>
              )}
              {["queued", "running"].includes(result.status) && (
                <button
                  className="wd-text-button"
                  onClick={() =>
                    act(async () => {
                      setResult(await api(`jobs/${result.jobId}/cancel`, {}));
                      await refresh();
                    })
                  }
                >
                  Cancel future work
                </button>
              )}
            </section>
          )}
          <footer className="wd-footer">
            <span>AIHackr · Affordable web data for AI agents.</span>
            <span>
              Public sources. Explicit limits.{" "}
              <Link href="/privacy">Privacy</Link>
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
