import {
  BlogPostLayout,
  Lead,
  Para,
  H2,
  H3,
  BulletList,
  OrderedList,
  LI,
  Strong,
  Em,
  Code,
  Callout,
  DataTable,
  Methodology,
  CompanyChip,
  ProviderChipRow,
} from "@/components/blog-post";

import { Link } from "wouter";
export default function Post() {
  const body = (
    <>
      <Lead>
        Most coverage of LLM adoption is anecdotal. AIHackr scans the SaaS
        index on a 7-day cadence (24h on Pro), so this column is{" "}
        <Em>data</Em> — not gossip — about which AI provider migrations
        actually happened in the last week. The live diff is on the
        leaderboard; here is what we&apos;ve been watching and why these
        moves matter.
      </Lead>

      <H2>How we surface changes</H2>

      <Para>
        Every Friday the leaderboard refreshes a panel called{" "}
        <Em>This week&apos;s changes</Em>: every product whose primary AI
        provider attribution moved across the confidence floor in either
        direction since the last comparable scan. The rules behind that
        panel are deliberately strict.
      </Para>

      <OrderedList>
        <LI>
          <Strong>Compare like for like.</Strong> The this-week diff
          compares each company&apos;s most recent scan against its
          previous scan from at least 5 days earlier — never two scans on
          the same day, which would just amplify single-cycle noise.
        </LI>
        <LI>
          <Strong>Apply the 0.60 confidence floor.</Strong> A drift in
          confidence inside the same bucket isn&apos;t a change. A
          provider has to cross the floor for the alert to fire.
        </LI>
        <LI>
          <Strong>Require two-scan confirmation for removals.</Strong> A
          provider is only considered <Em>removed</Em> when it falls below
          the floor on two consecutive scans. This eliminates most flaky
          single-scan disappearances.
        </LI>
        <LI>
          <Strong>Roll up gateways correctly.</Strong> A product moving
          from OpenAI direct to OpenAI behind a gateway is{" "}
          <Em>not</Em> a provider change — it&apos;s a delivery-path
          change. We surface those separately in the same panel.
        </LI>
      </OrderedList>

      <Callout tone="info" title="Why we publish this weekly, not real-time">
        Real-time alerts to subscribers fire as soon as a confirmed change
        crosses the floor. This public column compresses a week of
        confirmed changes into one digest so it&apos;s readable. The data
        underneath is real-time on the{" "}
        <Link href="/leaderboard" className="text-primary hover:underline">
          leaderboard
        </Link>
        .
      </Callout>

      <H2>This week&apos;s headline movers</H2>

      <Para>
        The current set lives on the leaderboard&apos;s{" "}
        <Em>Changes this week</Em> panel. Each entry there links to the
        full intelligence report for that company, with the diff and the
        evidence trail behind the change. Patterns we have seen recur
        across multiple weekly digests:
      </Para>

      <DataTable
        headers={["Move", "What it usually means"]}
        rows={[
          [
            <Em key="r1">Added Anthropic alongside OpenAI</Em>,
            "A new feature shipped that needs long context or tool-use; rarely a full migration",
          ],
          [
            <Em key="r2">Provider hidden behind a new gateway</Em>,
            "Cost or rate-limit pressure crossed a threshold; gateway adopted in weeks",
          ],
          [
            <Em key="r3">OpenAI direct → Azure OpenAI</Em>,
            "Compliance-gated customer onboarded; almost always sticks",
          ],
          [
            <Em key="r4">Anthropic direct → Bedrock-served Claude</Em>,
            "AWS-first procurement, often after a regulated-customer ask",
          ],
          [
            <Em key="r5">Frontier provider → fine-tuned hosted</Em>,
            "Inference cost optimisation; visible from model-name change with same hostnames",
          ],
          [
            <Em key="r6">Hosted → in-VPC self-hosted</Em>,
            "Rare; usually inference spend &gt; $30k/mo on a stable workload",
          ],
        ]}
        caption="The recurring shape of provider transitions in the AIHackr weekly digest."
      />

      <H2>How to read a change correctly</H2>

      <H3>Net-add vs migration</H3>
      <Para>
        Most provider changes we publish are net-adds, not migrations. A
        product gaining Anthropic alongside its existing OpenAI is shipping
        a new feature, not abandoning OpenAI. Reading the diff as
        &quot;X migrated to Y&quot; when it&apos;s actually &quot;X added
        Y&quot; is the most common analyst mistake. We label both
        explicitly.
      </Para>

      <H3>Gateway adoption is a delivery-path change</H3>
      <Para>
        When OpenAI traffic moves from <Code>api.openai.com</Code> to{" "}
        <Code>gateway.ai.cloudflare.com/.../openai/...</Code>, the
        underlying provider hasn&apos;t changed — the way the request
        gets there has. We surface this in the panel because it predicts
        provider-routing changes that often follow within weeks (the team
        installed a gateway because they want optionality), but the
        underlying-provider attribution doesn&apos;t move yet.
      </Para>

      <H3>Watch for clusters</H3>
      <Para>
        One company switching is interesting; three companies in the same
        category switching the same way in the same week is a trend. The
        weekly digest highlights category-level clustering when it
        appears. Watching the cluster, not the individual move, is where
        the signal compounds.
      </Para>

      <H3>Watch for reversals</H3>
      <Para>
        A meaningful share of provider switches reverse within a quarter.
        A team adds Anthropic, evaluates it on real traffic for six weeks,
        and goes back to OpenAI when something didn&apos;t pencil out.
        Those reversals appear in the same digest a quarter later — they
        are often more informative than the original switch.
      </Para>

      <H2>Why these moves matter</H2>

      <H3>Provider switches are leading indicators of cost pressure</H3>
      <Para>
        Most product teams don&apos;t change providers because they want
        to. They change because something — cost, rate limits, a quality
        complaint, a customer requirement — forced their hand. The
        switch tells you what hit them. A wave of teams in the same
        category moving from OpenAI to Anthropic in the same month is
        usually a Mini-vs-Haiku price war or a rate-limit incident.
      </Para>

      <H3>Capability complaints map cleanly</H3>
      <Para>
        Teams that switch from OpenAI to Anthropic for code-agent
        workloads almost always do so for the same reason: long-context
        plus better tool-use behaviour on multi-file edits. Teams that go
        the other way are usually retreating from a tool-use regression in
        their own product or simplifying their inference stack.
      </Para>

      <H3>Gateway adoption is a maturity signal</H3>
      <Para>
        A team adopting a gateway is usually post-Series-A, has multiple
        AI surfaces in production, and has either been burned by an
        outage or wants to be insurance-positioned for the next one. When
        a category sees gateway adoption pick up, expect more
        multi-provider routing in the same category within a quarter.
      </Para>

      <H2>The week-over-week tempo is itself a signal</H2>

      <Para>
        We have been publishing this digest long enough to notice
        meta-patterns in the digest itself. The number of meaningful
        changes per week is not constant, and the spikes line up with
        external events more cleanly than you might expect.
      </Para>

      <Para>
        Two patterns recur. First: the week of any major model release
        (a new Claude version, a new GPT variant, a Gemini upgrade)
        produces 2–3x the normal volume of provider changes within
        14 days. Most of those are A/B evaluations rather than full
        switches, but they show up in our scan as new providers
        appearing alongside the existing one. Second: the first week
        of a calendar quarter usually shows a small bump in gateway
        adoption, almost certainly because budget committees approved
        a multi-vendor strategy at the previous quarter&apos;s review.
      </Para>

      <Para>
        Quiet weeks are also informative. A two-week stretch with
        almost no movement in our digest usually means the providers
        themselves shipped no major changes — the AI stack of SaaS
        is broadly reactive to vendor news, and when the vendors are
        quiet, the customers are too. If you are using this digest as
        an input to your own competitive monitoring, the gaps matter
        as much as the spikes.
      </Para>

      <H2>The kind of change we&apos;ll never publish</H2>

      <BulletList>
        <LI>
          <Strong>Marketing-page edits.</Strong> If the product&apos;s
          landing page swaps &quot;built on GPT&quot; for &quot;built on
          Claude&quot; but the wire traffic doesn&apos;t change, that&apos;s
          a marketing change, not a provider change.
        </LI>
        <LI>
          <Strong>Confidence drift inside a bucket.</Strong> A score moving
          from 0.84 to 0.79 is interesting internally; it isn&apos;t a
          public change.
        </LI>
        <LI>
          <Strong>Single-scan blips.</Strong> Anything that doesn&apos;t
          replicate on the next scan stays out of the public digest.
        </LI>
      </BulletList>

      <H2>Where to read the live diff</H2>

      <BulletList>
        <LI>
          The <Link href="/leaderboard" className="text-primary hover:underline">leaderboard</Link>{" "}
          surfaces the live <Em>Changes this week</Em> panel.
        </LI>
        <LI>
          Each company&apos;s <Code>/stack/&lt;slug&gt;</Code> page has an
          <Em> AI Stack History</Em> timeline going back through every
          confirmed change.
        </LI>
        <LI>
          Watchlist subscribers get email + Slack alerts the moment a
          change crosses the floor — the public digest just batches them.
        </LI>
      </BulletList>

      <H2>Featured companies we&apos;ve been watching</H2>

      <Para>
        These are products with the most active recent provider history;
        check their stack pages for the most up-to-date diff:
      </Para>

      <div className="my-4 flex flex-wrap gap-2">
        <CompanyChip slug="cursor" name="Cursor" />
        <CompanyChip slug="vercel" name="Vercel" />
        <CompanyChip slug="linear" name="Linear" />
        <CompanyChip slug="notion" name="Notion" />
        <CompanyChip slug="intercom" name="Intercom" />
      </div>

      <H2>Provider rollups for the weekly view</H2>
      <ProviderChipRow
        items={[
          { name: "OpenAI", slug: "openai" },
          { name: "Anthropic", slug: "anthropic" },
          { name: "Azure OpenAI", slug: "azure-openai" },
          { name: "AWS Bedrock", slug: "aws-bedrock" },
        ]}
      />

      <Methodology>
        <p>
          Weekly diff entries are produced by comparing each tracked
          company&apos;s most recent scan against the most recent prior
          scan that is at least 5 days older. A provider change is
          surfaced when the new scan&apos;s primary attribution differs
          from the prior scan&apos;s and both attributions are above the
          0.60 confidence floor. Removals require two consecutive
          below-floor scans before publication.
        </p>
        <p>
          Gateway delivery-path changes are surfaced in a separate column
          of the same panel and are not treated as provider changes for
          alert or attribution purposes. See{" "}
          <Link
            href="/blog/the-complete-guide-to-fingerprinting-ai-providers"
            className="text-primary hover:underline"
          >
            The Complete Guide to Fingerprinting AI Providers
          </Link>{" "}
          for the full scoring rubric.
        </p>
      </Methodology>
    </>
  );

  return (
    <BlogPostLayout
      slug="what-changed-this-week-in-saas-ai-stacks"
      title="What Changed This Week in SaaS AI Stacks"
      description="A weekly pulse on which SaaS products switched AI providers, added new model families, or quietly migrated to gateways — surfaced from continuous scans, not anecdote."
      publishedTime="2026-04-17T00:00:00Z"
      modifiedTime="2026-04-22T00:00:00Z"
      displayDate="April 2026"
      category="Weekly Pulse"
      keywords="SaaS AI changes this week, AI provider migrations, weekly AI report, who changed AI provider"
      related={{
        providers: [
          { name: "OpenAI", slug: "openai" },
          { name: "Anthropic", slug: "anthropic" },
          { name: "Azure OpenAI", slug: "azure-openai" },
        ],
        companies: [
          { name: "Linear", slug: "linear" },
          { name: "Notion", slug: "notion" },
          { name: "Cursor", slug: "cursor" },
        ],
        posts: [
          {
            title: "The State of AI in SaaS — 2026",
            slug: "the-state-of-ai-in-saas-2026",
          },
          {
            title: "OpenAI vs Anthropic: which SaaS uses which",
            slug: "openai-vs-anthropic-which-saas-companies-use-which",
          },
          {
            title: "AI Gateways Explained",
            slug: "ai-gateways-explained-cloudflare-portkey-helicone",
          },
        ],
      }}
      body={body}
    />
  );
}
