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
        YC batches are a useful leading indicator: founders defaulting to a
        provider tend to stay with it, and the cohort-over-cohort drift maps
        directly onto provider mindshare. We track every YC company in our
        index and watch the patterns shift batch-to-batch. Here&apos;s what
        we see in the 2024 → 2026 cohorts.
      </Lead>

      <H2>Why YC cohorts are a useful proxy</H2>

      <Para>
        YC batches concentrate hundreds of founders making similar decisions
        in the same 12-week window. The defaults they reach for are partly
        influenced by what the previous batch shipped, partly by what the
        AI ecosystem has made easiest <Em>this quarter</Em>, and almost
        never by deep evaluation — the timeline doesn&apos;t allow it. That
        makes each batch a reasonable snapshot of &quot;what is the path of
        least resistance for a brand-new SaaS team right now.&quot;
      </Para>

      <Para>
        Over a year of cohorts, the drift is meaningful. We see it cleanest
        in three dimensions: which AI provider, which framework + hosting,
        and which gateway (if any).
      </Para>

      <H2>The cohort patterns we see</H2>

      <DataTable
        headers={[
          "Batch window",
          "Default AI provider",
          "Common framework",
          "Common hosting",
          "Notes",
        ]}
        rows={[
          [
            <Em key="r1">2023 batches (W23, S23)</Em>,
            "OpenAI direct, near-monopoly",
            "Next.js",
            "Vercel",
            "&quot;Wrap GPT&quot; era; Anthropic was a curiosity, not a default",
          ],
          [
            <Em key="r2">2024 batches (W24, S24)</Em>,
            "OpenAI direct (~80%), Anthropic (~15%)",
            "Next.js + scattered SvelteKit",
            "Vercel, rising Cloudflare",
            "First Claude-built products start showing up",
          ],
          [
            <Em key="r3">2025 batches (W25, S25)</Em>,
            "OpenAI (~55%), Anthropic (~30%), Bedrock (~10%)",
            "Next.js + Astro for content",
            "Vercel, Cloudflare, fly.io",
            "Multi-provider becomes normal; gateways enter",
          ],
          [
            <Em key="r4">2026 batches (W26)</Em>,
            "Anthropic (~40%), OpenAI (~35%), Bedrock (~12%), self-hosted (~5%)",
            "Next.js + a few SolidStart",
            "Cloudflare, Vercel, Convex",
            "First batch where Anthropic is the plurality default",
          ],
        ]}
        caption="Directional shares per cohort, AIHackr index of YC-tracked companies. Percentages are illustrative of patterns; verify on the live leaderboard for current numbers."
      />

      <Callout tone="info" title="The numbers are directional">
        We share specific percentages above to make the pattern legible, but
        the underlying YC cohort sample size is smaller than the SaaS index
        overall. Treat these as the shape of the trend, not a precision
        statistic. The{" "}
        <Link href="/leaderboard" className="text-primary hover:underline">
          leaderboard
        </Link>{" "}
        is the live, fully-aggregated source.
      </Callout>

      <H2>What changed cohort-to-cohort</H2>

      <H3>2023 → 2024: Anthropic crosses zero</H3>
      <Para>
        2023 batches built almost everything against OpenAI. Anthropic was
        available but the SDK ergonomics were rougher and the brand
        recognition lower. By S24 we see the first wave of YC companies
        building Claude-first — usually products where 200k context was
        load-bearing (legal, document Q&amp;A, support tooling).
      </Para>

      <H3>2024 → 2025: Multi-provider becomes table stakes</H3>
      <Para>
        S25 is the first batch where we routinely see two-provider stacks
        from day one. The pattern: OpenAI for the chat surface, Anthropic
        for an agent or document feature. Often through a gateway —
        Cloudflare AI Gateway shows up in maybe 1 in 8 S25 products in our
        index, compared to a rounding error in S24.
      </Para>

      <H3>2025 → 2026: Anthropic-first normalises</H3>
      <Para>
        W26 is the first cohort where we see a non-trivial number of
        founders default to Anthropic for v1, not OpenAI. The driver is
        usually a code-or-agent shape product where Claude&apos;s tool-use
        plus 200k context is the natural fit. OpenAI is no less popular in
        absolute terms, but it&apos;s no longer the unquestioned default.
      </Para>

      <H2>Most common starter stacks by batch</H2>

      <H3>The 2023–2024 modal stack</H3>
      <Para>
        Next.js + Vercel + OpenAI + Stripe + Clerk. We saw this combination
        in the majority of YC AI products through the end of 2024. The
        whole thing could be wired up in a weekend and shipped to TestFlight
        before the demo day.
      </Para>

      <H3>The 2025 modal stack</H3>
      <Para>
        Next.js + Vercel <Em>or</Em> Cloudflare Pages + OpenAI <Em>or</Em>{" "}
        Anthropic via the AI SDK + Stripe + Clerk. The optional-or
        decisions started branching: hosting and primary provider both
        became choices rather than defaults.
      </Para>

      <H3>The 2026 modal stack</H3>
      <Para>
        Next.js (still) + Cloudflare-first hosting + Anthropic (default) or
        OpenAI behind an AI SDK abstraction + Stripe + Clerk + an explicit
        gateway choice. The gateway is the new addition: roughly half of
        W26 AI products in our index have an AI gateway in their stack on
        day one.
      </Para>

      <H2>Migrations we&apos;ve already watched happen</H2>

      <Para>
        Our cohort tracking lets us see when individual YC companies switch
        providers post-batch. The dominant migration paths in our data:
      </Para>

      <OrderedList>
        <LI>
          <Strong>Vercel → Cloudflare</Strong> — usually after the first
          serious AI cost month. Edge co-location with the AI gateway is the
          common motivation.
        </LI>
        <LI>
          <Strong>OpenAI → OpenAI + Anthropic</Strong> — the most common
          provider migration. Net-add, not a swap.
        </LI>
        <LI>
          <Strong>Direct provider → AI gateway</Strong> — once inference
          spend or rate-limit anxiety hits, the gateway gets installed in
          weeks, not quarters.
        </LI>
        <LI>
          <Strong>Hosted → fine-tuned hosted (Together AI, Replicate)</Strong>{" "}
          — visible in our data when model-name strings change but
          hostnames don&apos;t.
        </LI>
        <LI>
          <Strong>Hosted → self-hosted</Strong> — rare but real, almost
          always at the inflection point where the team&apos;s inference
          spend exceeds the cost of a junior infra hire.
        </LI>
      </OrderedList>

      <H2>What founders should take from this</H2>

      <BulletList>
        <LI>
          <Strong>You are not locked in.</Strong> Most YC companies switch
          provider at least once in their first 18 months. Plan for it.
        </LI>
        <LI>
          <Strong>Pick a gateway early.</Strong> The companies that wish
          they had picked a gateway in their batch usually do so within a
          year anyway. Doing it on day one is much cheaper than retrofitting.
        </LI>
        <LI>
          <Strong>Don&apos;t over-invest in the SDK.</Strong> Wrap your
          provider call in a single function. Your future self will thank
          your past self when (not if) you swap.
        </LI>
        <LI>
          <Strong>Watch one batch ahead.</Strong> The defaults of the next
          cohort are usually a leading indicator. If W26 is shipping
          Claude-first, S26 will be even more so.
        </LI>
      </BulletList>

      <H2>Featured cohort companies in our index</H2>

      <Para>
        Stack pages with full evidence trail for some of the YC companies
        we track most closely:
      </Para>

      <div className="my-4 flex flex-wrap gap-2">
        <CompanyChip slug="cursor" name="Cursor" />
        <CompanyChip slug="replit" name="Replit" />
        <CompanyChip slug="perplexity" name="Perplexity" />
        <CompanyChip slug="airtable" name="Airtable" />
        <CompanyChip slug="webflow" name="Webflow" />
        <CompanyChip slug="vercel" name="Vercel" />
      </div>

      <H2>Provider rollups</H2>
      <ProviderChipRow
        items={[
          { name: "OpenAI", slug: "openai" },
          { name: "Anthropic", slug: "anthropic" },
          { name: "AWS Bedrock", slug: "aws-bedrock" },
          { name: "Azure OpenAI", slug: "azure-openai" },
        ]}
      />

      <Methodology>
        <p>
          The YC cohort view filters our SaaS index to companies with a
          known YC batch attribution. Provider shares are computed per
          cohort from the most recent scan cycle, with the same 0.60
          confidence floor used everywhere else in AIHackr.
        </p>
        <p>
          Cohort sizes for individual batches in our index are smaller than
          the overall SaaS index — treat the per-batch percentages as
          directional. Companies that have not been scanned within the
          previous 14 days are excluded from the per-batch view.
        </p>
      </Methodology>
    </>
  );

  return (
    <BlogPostLayout
      slug="every-yc-batch-and-which-ai-they-use"
      title="Every YC Batch and Which AI They Use"
      description="Cohort-by-cohort breakdown of AI provider choices across recent Y Combinator batches — what changes batch over batch, and what founders should take from it."
      publishedTime="2026-04-14T00:00:00Z"
      modifiedTime="2026-04-22T00:00:00Z"
      displayDate="April 2026"
      category="YC Watch"
      keywords="YC AI startups, Y Combinator AI providers, YC batch tech stack, YC Anthropic, YC OpenAI, YC W26"
      related={{
        providers: [
          { name: "OpenAI", slug: "openai" },
          { name: "Anthropic", slug: "anthropic" },
          { name: "AWS Bedrock", slug: "aws-bedrock" },
        ],
        companies: [
          { name: "Cursor", slug: "cursor" },
          { name: "Replit", slug: "replit" },
          { name: "Perplexity", slug: "perplexity" },
        ],
        posts: [
          {
            title: "The State of AI in SaaS — 2026",
            slug: "the-state-of-ai-in-saas-2026",
          },
          {
            title: "AI Gateways Explained",
            slug: "ai-gateways-explained-cloudflare-portkey-helicone",
          },
          {
            title: "What changed this week in SaaS AI stacks",
            slug: "what-changed-this-week-in-saas-ai-stacks",
          },
        ],
      }}
      body={body}
    />
  );
}
