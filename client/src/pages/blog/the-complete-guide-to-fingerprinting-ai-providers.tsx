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
  CodeBlock,
  Callout,
  DataTable,
  Methodology,
} from "@/components/blog-post";

import { Link } from "wouter";
export default function Post() {
  const body = (
    <>
      <Lead>
        This is the long-form companion to{" "}
        <Link
          href="/blog/how-to-tell-which-llm-a-website-is-using"
          className="text-primary hover:underline"
        >
          How to tell which LLM a website is using
        </Link>{" "}
        — the field manual we wish we had had when we started building
        AIHackr. It covers the signal hierarchy, the confidence math, the
        common false positives, and the ethical guardrails that keep this
        kind of work honest.
      </Lead>

      <H2>The signal hierarchy</H2>

      <Para>
        Not all evidence is equal. The single biggest mistake in homemade
        AI fingerprinting is treating a marketing-page mention of
        &quot;powered by GPT&quot; the same as a network-level call to{" "}
        <Code>api.openai.com</Code>. We use a strict three-tier hierarchy.
      </Para>

      <DataTable
        headers={["Tier", "What it is", "Examples", "Base score"]}
        rows={[
          [
            <Em key="t1">Tier 1 — provider-owned signals</Em>,
            "Hostnames and infrastructure that only a vendor controls",
            <span key="e1">
              <Code>api.openai.com</Code>, <Code>*.openai.azure.com</Code>,{" "}
              <Code>bedrock-runtime.*.amazonaws.com</Code>
            </span>,
            "0.85",
          ],
          [
            <Em key="t2">Tier 2 — protocol signals</Em>,
            "Request/response schemas and SDK signatures that fingerprint a provider even through a proxy",
            <span key="e2">
              OpenAI SSE <Code>delta.content</Code>, Anthropic{" "}
              <Code>content_block_delta</Code>, AWS Eventstream framing,{" "}
              <Code>@anthropic-ai/sdk</Code> in JS bundles
            </span>,
            "0.55",
          ],
          [
            <Em key="t3">Tier 3 — vendor mentions</Em>,
            "Public claims that should corroborate but never carry alone",
            "Marketing copy, trust pages, JSON-LD schema, third-party crawls",
            "0.20",
          ],
        ]}
        caption="The three-tier signal hierarchy AIHackr uses for AI provider attribution."
      />

      <Callout tone="warning" title="The cardinal rule">
        We never collapse a Tier 3 hit into a high-confidence label. A
        marketing page that says &quot;powered by GPT&quot; with no
        observable wire traffic to OpenAI is a Tier 3-only signal at best —
        worth recording, not worth concluding from.
      </Callout>

      <H2>Confidence scoring</H2>

      <Para>
        Each detected signal carries a base score by tier (above). When
        multiple signals fire for the same provider, we stack them with
        diminishing returns:
      </Para>

      <CodeBlock language="pseudocode">{`signals = [s for s in detected if s.provider == p]
score = 0
for s in sorted(signals, by=base_score, desc=True):
    contribution = s.base_score * (1 - score)
    score += contribution
# clamp to [0, 1]`}</CodeBlock>

      <Para>
        The diminishing-returns rule means: a single Tier 1 signal alone
        already gets you to ~0.85. Adding a Tier 2 corroborator nudges it
        to ~0.93. A Tier 3 mention on top adds almost nothing. This stops
        us from over-weighting redundant evidence.
      </Para>

      <H3>The buckets we publish</H3>

      <DataTable
        headers={["Bucket", "Score range", "Meaning"]}
        rows={[
          [
            <Em key="b1">High</Em>,
            "≥ 0.80",
            "Multiple corroborating signals or one unambiguous Tier 1",
          ],
          [
            <Em key="b2">Medium</Em>,
            "0.60 – 0.79",
            "One strong signal with weaker corroboration",
          ],
          [
            <Em key="b3">Low</Em>,
            "0.40 – 0.59",
            "Indirect evidence; useful as a hint, not a fact",
          ],
          [
            <Em key="b4">None</Em>,
            "&lt; 0.40",
            "Not enough evidence to publish",
          ],
        ]}
      />

      <H3>The 0.60 floor</H3>
      <Para>
        For alerts and &quot;present/absent&quot; classifications — the
        binary calls that drive our weekly diff and our watchlist
        notifications — we apply a 0.60 confidence floor. A provider is
        only considered <Em>present</Em> on a product if it scores 0.60 or
        higher. A provider is only considered <Em>removed</Em> when it
        crosses below the floor on two consecutive scans. This eliminates
        most single-scan flakes.
      </Para>

      <H2>Common false positives</H2>

      <Para>
        Every fingerprinting system is wrong sometimes. The mistakes are
        not random; they cluster into a few patterns we have learned to
        watch for.
      </Para>

      <H3>1. The marketing-page lie</H3>
      <Para>
        A landing page says &quot;built on GPT-4&quot; while the actual
        product chat surface routes to Anthropic. This usually happens
        because the marketing copy was written before the migration. We
        treat the page mention as Tier 3 only and rely on the product
        surface for attribution.
      </Para>

      <H3>2. Third-party scripts that themselves call OpenAI</H3>
      <Para>
        Several analytics, CRM, and chat-widget vendors call OpenAI from
        their own scripts loaded inside the host product. A naïve
        fingerprint would attribute the host as &quot;using OpenAI&quot;
        when the OpenAI traffic is the embedded vendor&apos;s, not the
        host product&apos;s. We exclude known third-party-script-originated
        AI calls explicitly.
      </Para>

      <H3>3. Stale CDN snapshots</H3>
      <Para>
        Right after a migration, the JS bundle in the CDN may still
        reference the old SDK while live traffic goes to the new provider.
        We re-scan after detected migrations to catch this; users who scan
        manually within 24 hours of a deploy may see transient mismatches.
      </Para>

      <H3>4. A/B-tested provider routes</H3>
      <Para>
        A product may be running OpenAI for half its sessions and Anthropic
        for the other half as part of an evaluation. Both providers will
        appear in our scans. We surface this as &quot;both providers
        present&quot; rather than picking one — the truth is genuinely
        both.
      </Para>

      <H3>5. Gateways that obscure the underlying provider</H3>
      <Para>
        Discussed at length in{" "}
        <Link
          href="/blog/ai-gateways-explained-cloudflare-portkey-helicone"
          className="text-primary hover:underline"
        >
          AI Gateways Explained
        </Link>
        . When a gateway hides the model name and we cannot resolve the
        underlying provider above the floor, we report the gateway only and
        mark the underlying provider as unknown rather than guess.
      </Para>

      <H2>Provider-by-provider detection notes</H2>

      <H3>OpenAI</H3>
      <BulletList>
        <LI>
          Tier 1: <Code>api.openai.com</Code>; SSE response with{" "}
          <Code>choices[].delta.content</Code>.
        </LI>
        <LI>
          Tier 2: <Code>Authorization: Bearer sk-...</Code>;{" "}
          <Code>OpenAI(</Code> instantiation in bundles.
        </LI>
        <LI>
          False-positive risk: low. The fingerprint is unambiguous.
        </LI>
      </BulletList>

      <H3>Anthropic</H3>
      <BulletList>
        <LI>
          Tier 1: <Code>api.anthropic.com</Code>; SSE events with{" "}
          <Code>content_block_delta</Code>.
        </LI>
        <LI>
          Tier 2: top-level <Code>system</Code> field in the request body
          (a request-shape fingerprint that survives proxies);{" "}
          <Code>anthropic-version</Code> header.
        </LI>
        <LI>
          False-positive risk: low. Top-level <Code>system</Code> rarely
          appears in non-Anthropic schemas.
        </LI>
      </BulletList>

      <H3>Azure OpenAI</H3>
      <BulletList>
        <LI>
          Tier 1: <Code>*.openai.azure.com</Code>,{" "}
          <Code>*.cognitiveservices.azure.com</Code>.
        </LI>
        <LI>
          Tier 2: <Code>api-key</Code> header (vs OpenAI&apos;s Bearer);{" "}
          <Code>/openai/deployments/&lt;name&gt;</Code> path with{" "}
          <Code>api-version</Code> query param.
        </LI>
        <LI>
          Note: response shape is identical to OpenAI direct — distinguish
          by the URL path and auth header.
        </LI>
      </BulletList>

      <H3>AWS Bedrock</H3>
      <BulletList>
        <LI>
          Tier 1: <Code>bedrock-runtime.*.amazonaws.com</Code>; SigV4 auth
          header.
        </LI>
        <LI>
          Tier 2: AWS Eventstream framing; model identifier in URL path
          (<Code>anthropic.claude-...</Code>, <Code>meta.llama3-...</Code>,
          <Code>amazon.titan-...</Code>).
        </LI>
        <LI>
          False-positive risk: medium when traffic is server-side proxied.
          We may under-attribute Bedrock vs its true production footprint.
        </LI>
      </BulletList>

      <H3>Google Gemini</H3>
      <BulletList>
        <LI>
          Tier 1: <Code>generativelanguage.googleapis.com</Code> or Vertex
          AI hostnames.
        </LI>
        <LI>
          Tier 2: SDK strings; the <Code>candidates[].content.parts</Code>{" "}
          response shape.
        </LI>
        <LI>
          False-positive risk: low. Distinct hostnames, distinct response shape.
        </LI>
      </BulletList>

      <H3>Self-hosted (Llama, Mistral, custom)</H3>
      <BulletList>
        <LI>
          Tier 1 (negative): no recognised provider hostnames present.
        </LI>
        <LI>
          Tier 2: vLLM/TGI/Triton response signatures; OpenAI-compatible
          responses with non-frontier model identifiers in the body.
        </LI>
        <LI>
          False-positive risk: high without corroboration. We require
          multiple Tier 2 signals and Tier 3 corroboration (engineering
          blog, job listing) before attributing self-hosted.
        </LI>
      </BulletList>

      <H2>Ethical guardrails</H2>

      <Para>
        Wire-level fingerprinting is a powerful capability and the wrong
        kind of system would be invasive. Our guardrails:
      </Para>

      <OrderedList>
        <LI>
          <Strong>Passive scanning only.</Strong> We read what a
          product&apos;s homepage and product surface present to anonymous
          users. We don&apos;t exploit, brute-force, or auth-bypass. If a
          product hides its AI surface behind login, we don&apos;t see it.
        </LI>
        <LI>
          <Strong>robots.txt is law.</Strong> If a host disallows our
          user agent, we stop. We don&apos;t ignore disallow rules and we
          don&apos;t evade them by changing identity.
        </LI>
        <LI>
          <Strong>Rate limits are courtesy.</Strong> We rate-limit
          aggressively per host so a single product&apos;s scan never
          looks like an attack to their WAF.
        </LI>
        <LI>
          <Strong>Evidence over assertion.</Strong> Every detection links
          back to the signals it relied on. A user who disagrees with our
          attribution can see exactly what we saw and why.
        </LI>
        <LI>
          <Strong>Take-down on request.</Strong> A company can ask to be
          removed from our public index for any reason. We honour that
          quickly and document it.
        </LI>
      </OrderedList>

      <H2>What we explicitly do not do</H2>

      <BulletList>
        <LI>
          We don&apos;t crawl behind authentication, even if credentials
          could be obtained.
        </LI>
        <LI>
          We don&apos;t run JavaScript in ways that invoke side-effecting
          API calls beyond what a normal anonymous visit would trigger.
        </LI>
        <LI>
          We don&apos;t exfiltrate or persist any prompt content or user
          PII that may pass through observed traffic.
        </LI>
        <LI>
          We don&apos;t attribute confidently from any single Tier 3
          signal alone.
        </LI>
      </BulletList>

      <H2>Why this matters</H2>

      <Para>
        AI provider attribution is going to become a normal part of
        software due diligence — for customers, regulators, investors, and
        competitors. Doing it well means doing it transparently, with a
        documented confidence model and an honest guardrails posture.
        Doing it badly means a market full of confidently wrong
        &quot;intelligence&quot; tools that name a provider for a product
        based on a single tweet.
      </Para>

      <Para>
        This is the methodology behind every AIHackr scan. If you spot
        something we are getting wrong, the evidence trail is right there
        on the product&apos;s stack page; tell us, and we will trace it
        with you.
      </Para>

      <Methodology>
        <p>
          This document is the long-form description of the scoring rules
          implemented in <Code>server/scanner.ts</Code> and the alert
          lifecycle in <Code>server/background-worker.ts</Code>. Numbers
          (base scores, floor) may be tuned over time as we observe new
          provider behaviours; we publish the scoring constants in our
          methodology page and update this guide when they change.
        </p>
        <p>
          See also{" "}
          <Link
            href="/blog/how-to-tell-which-llm-a-website-is-using"
            className="text-primary hover:underline"
          >
            How to tell which LLM a website is using
          </Link>{" "}
          for the practitioner&apos;s checklist version.
        </p>
      </Methodology>
    </>
  );

  return (
    <BlogPostLayout
      slug="the-complete-guide-to-fingerprinting-ai-providers"
      title="The Complete Guide to Fingerprinting AI Providers"
      description="Everything we&apos;ve learned building AIHackr — the signals, scoring rules, false-positive patterns, and ethical guardrails behind reliable AI provider attribution."
      publishedTime="2026-04-18T00:00:00Z"
      modifiedTime="2026-04-22T00:00:00Z"
      displayDate="April 2026"
      category="Methodology"
      keywords="fingerprint AI provider, LLM detection methodology, AI attribution, AIHackr methodology, how AIHackr detects AI"
      related={{
        providers: [
          { name: "OpenAI", slug: "openai" },
          { name: "Anthropic", slug: "anthropic" },
          { name: "Azure OpenAI", slug: "azure-openai" },
          { name: "AWS Bedrock", slug: "aws-bedrock" },
        ],
        companies: [
          { name: "Notion", slug: "notion" },
          { name: "Cursor", slug: "cursor" },
        ],
        posts: [
          {
            title: "How to tell which LLM a website is using",
            slug: "how-to-tell-which-llm-a-website-is-using",
          },
          {
            title: "AI Gateways Explained",
            slug: "ai-gateways-explained-cloudflare-portkey-helicone",
          },
          {
            title: "The State of AI in SaaS — 2026",
            slug: "the-state-of-ai-in-saas-2026",
          },
        ],
      }}
      body={body}
    />
  );
}
