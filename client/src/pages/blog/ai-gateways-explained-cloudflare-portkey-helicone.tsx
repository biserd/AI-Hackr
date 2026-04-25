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
  CompanyChip,
} from "@/components/blog-post";

export default function Post() {
  const body = (
    <>
      <Lead>
        An AI gateway sits between your application and your LLM provider,
        handling caching, rate limits, fallbacks, observability, and provider
        routing. Two years ago they were niche; today roughly 1 in 5 SaaS
        products in our index sit behind one. Here is what they do, why teams
        adopt them, and exactly how AIHackr fingerprints traffic that has
        been routed through them.
      </Lead>

      <H2>What an AI gateway actually does</H2>

      <Para>
        Strip away the marketing — an AI gateway is an HTTP proxy that
        speaks the LLM provider protocols on behalf of your application.
        Your code calls the gateway as if it were OpenAI; the gateway calls
        OpenAI (or Anthropic, or Bedrock, or all three) on your behalf and
        adds capabilities your code didn&apos;t have before.
      </Para>

      <DataTable
        headers={["Capability", "What it does", "Why teams turn it on"]}
        rows={[
          [
            <Em key="r1">Multi-provider routing</Em>,
            "Pick OpenAI, Anthropic, or Bedrock per request",
            "Failover when a provider rate-limits; A/B test models in production",
          ],
          [
            <Em key="r2">Semantic caching</Em>,
            "Hash the prompt embedding; reuse a similar past response",
            "20-60% cost reduction on chat surfaces with repeated patterns",
          ],
          [
            <Em key="r3">Per-tenant budgets</Em>,
            "Cap tokens or dollars per customer",
            "Stop a single customer from blowing your inference budget",
          ],
          [
            <Em key="r4">Request-level traces</Em>,
            "Latency, tokens, prompt, response captured per request",
            "Skip building your own observability stack",
          ],
          [
            <Em key="r5">PII redaction</Em>,
            "Pre-process prompts before they leave your boundary",
            "Compliance and customer-data hygiene",
          ],
          [
            <Em key="r6">Provider abstraction</Em>,
            "One client SDK to call any provider",
            "Swap providers without a code change",
          ],
        ]}
      />

      <H2>The four gateways we see in production</H2>

      <H3>Cloudflare AI Gateway</H3>
      <Para>
        Hosted at <Code>gateway.ai.cloudflare.com</Code>. The free tier and
        co-location with Cloudflare&apos;s edge make it the easiest gateway
        to add to a product already on Cloudflare. We see it most in smaller
        SaaS and side-projects. Multi-provider, caching, analytics. Free
        for most reasonable usage.
      </Para>

      <H3>Portkey</H3>
      <Para>
        Hosted at <Code>api.portkey.ai</Code>; identifies via{" "}
        <Code>x-portkey-*</Code> request headers. Strong on per-tenant
        controls and an opinionated routing config language. Common in
        product-led SaaS that want gateway features without rolling their
        own.
      </Para>

      <H3>Helicone</H3>
      <Para>
        Hosted at <Code>oai.helicone.ai</Code> (or the older{" "}
        <Code>oai.hconeai.com</Code>) for OpenAI-shaped traffic, with parallel
        endpoints for Anthropic and others. Strongest on observability —
        clean traces, cost dashboards, and a sane log explorer. We see it
        especially in teams that started with OpenAI direct and bolted
        Helicone on for visibility without a full migration.
      </Para>

      <H3>OpenRouter</H3>
      <Para>
        Hosted at <Code>openrouter.ai</Code>. The aggregator that exposes
        every model behind one OpenAI-compatible API, with one bill. We see
        it most in indie products and consumer-facing surfaces where
        &quot;every model in one place&quot; is the user-facing pitch, not
        just an internal lever.
      </Para>

      <Callout tone="tip" title="Self-rolled gateways exist too">
        Larger SaaS sometimes build their own thin gateway layer rather than
        adopt one of the above. We can usually still detect &quot;there is a
        gateway in front of OpenAI&quot; from the request shape, even when
        the gateway is anonymous.
      </Callout>

      <H2>Detection signatures we use</H2>

      <H3>Tier 1 — gateway hostnames in fetch/XHR</H3>
      <BulletList>
        <LI>
          Cloudflare AI Gateway: <Code>gateway.ai.cloudflare.com</Code>
        </LI>
        <LI>
          Portkey: <Code>api.portkey.ai</Code> or any{" "}
          <Code>x-portkey-*</Code> response header
        </LI>
        <LI>
          Helicone: <Code>oai.helicone.ai</Code>,{" "}
          <Code>oai.hconeai.com</Code>, <Code>anthropic.helicone.ai</Code>
        </LI>
        <LI>
          OpenRouter: <Code>openrouter.ai</Code> with a{" "}
          <Code>HTTP-Referer</Code> identifying the calling app
        </LI>
      </BulletList>

      <H3>Tier 2 — request body schema</H3>
      <Para>
        The gateway translates between your code and the underlying
        provider, but it almost always preserves the underlying provider&apos;s
        request schema. That means we can <Em>still</Em> attribute the real
        provider from the JSON body even when the host is the gateway:
      </Para>

      <CodeBlock language="example">{`POST https://gateway.ai.cloudflare.com/v1/<account>/<gateway>/openai/chat/completions
Authorization: Bearer sk-...

{ "model": "gpt-4o", "messages": [...], "stream": true }`}</CodeBlock>

      <Para>
        Hostname says &quot;Cloudflare AI Gateway&quot;. Request body says{" "}
        <Code>gpt-4o</Code>. Both are true. We attribute the gateway as the
        delivery path and OpenAI as the underlying provider. This pattern is
        why a naïve hostname-only fingerprint mis-classifies all gateway
        traffic.
      </Para>

      <H3>Tier 3 — response shape</H3>
      <BulletList>
        <LI>
          OpenAI-compatible gateways preserve OpenAI&apos;s{" "}
          <Code>choices[].delta.content</Code> SSE shape.
        </LI>
        <LI>
          Anthropic-compatible passthroughs preserve{" "}
          <Code>content_block_delta</Code> events.
        </LI>
        <LI>
          Helicone often adds a <Code>helicone-id</Code> header to responses.
        </LI>
      </BulletList>

      <H2>Why ~1 in 5 SaaS now use one</H2>

      <Para>
        The shift in the last 18 months has three drivers:
      </Para>

      <OrderedList>
        <LI>
          <Strong>Rate-limit anxiety.</Strong> One bad weekend on OpenAI
          (think December 2024) is usually all it takes for a CTO to
          authorize a multi-provider gateway. The gateway pays for itself the
          first time a primary provider rate-limits during business hours.
        </LI>
        <LI>
          <Strong>Cost discipline at scale.</Strong> Once a product is
          spending $30k+/month on inference, semantic caching and per-tenant
          budgets stop being theoretical. We have watched products cut
          inference cost by 40% via caching alone after switching on a
          gateway.
        </LI>
        <LI>
          <Strong>Observability.</Strong> Building &quot;what did we send,
          what came back, how much did it cost&quot; per request is a
          surprising amount of work. The gateways already did it.
        </LI>
      </OrderedList>

      <H2>What gateways break — and how to see through them</H2>

      <Para>
        The honest truth: gateways are an obstacle to provider attribution if
        all you have is a hostname-based fingerprint. AIHackr&apos;s fix is a
        layered detection that does not stop at the host:
      </Para>

      <BulletList>
        <LI>
          We extract the <Code>model</Code> field from request bodies when
          available. <Code>gpt-4o</Code>, <Code>claude-3-5-sonnet-20240620</Code>
          , <Code>anthropic.claude-3-5-sonnet</Code> (Bedrock-flavoured), and
          friends are unambiguous.
        </LI>
        <LI>
          We look at response framing — OpenAI SSE vs Anthropic SSE vs
          Bedrock Eventstream are visually distinct on the wire.
        </LI>
        <LI>
          We check JS bundles for SDK signatures (<Code>openai</Code>,{" "}
          <Code>@anthropic-ai/sdk</Code>, <Code>@aws-sdk/client-bedrock-runtime</Code>).
        </LI>
        <LI>
          When all of these are inconclusive, we report &quot;gateway present,
          underlying provider unknown&quot; rather than guess. Honesty about
          confidence is the whole point.
        </LI>
      </BulletList>

      <Callout tone="warning" title="Gateway with model-name redaction">
        A small but growing number of teams strip the model name from
        outbound requests at their own backend before the gateway. This is
        the only defense against external attribution short of running
        everything server-side. We will report the underlying provider as
        unknown rather than guess in these cases.
      </Callout>

      <H2>The build-vs-buy question, honestly</H2>

      <Para>
        Every team eventually asks whether to use a hosted gateway or
        build a thin internal one. The honest answer depends on a
        single question: how much of the gateway feature surface do
        you actually need on day one? If the answer is &quot;just
        retries and a circuit breaker,&quot; building it yourself in
        a couple of days is genuinely fine and avoids one more
        vendor in your auth chain. The internal gateway is usually
        50–150 lines of code wrapping the OpenAI and Anthropic SDKs.
      </Para>

      <Para>
        The buy case becomes obvious once you need three or more of:
        per-tenant rate limits, semantic caching with eviction
        policies, prompt-version tracking, multi-region failover,
        cost attribution by feature flag, or a UI for non-engineers
        to inspect prompts. Building any one of those is a quarter
        of work; building all of them is a small team. We watch this
        decision play out in our index every quarter, and the
        teams that built early almost always end up buying within
        18 months. The teams that bought early rarely regret it.
      </Para>

      <H2>If you&apos;re evaluating a gateway for your own product</H2>

      <H3>Pick a gateway when at least one of these is true</H3>
      <BulletList>
        <LI>
          Inference is more than 5% of your COGS.
        </LI>
        <LI>
          You have ever needed to fall back to a second provider during an
          outage.
        </LI>
        <LI>
          You want per-tenant cost or rate limits.
        </LI>
        <LI>
          You are about to build &quot;what was prompt → response → tokens
          → cost per request&quot; observability anyway.
        </LI>
      </BulletList>

      <H3>Skip a gateway when all of these are true</H3>
      <BulletList>
        <LI>
          You only use one provider and one model.
        </LI>
        <LI>
          Inference is &lt; 1% of your COGS.
        </LI>
        <LI>
          You already have full request observability via your existing APM.
        </LI>
        <LI>
          You don&apos;t want one more vendor in your stack.
        </LI>
      </BulletList>

      <H3>Pick which gateway based on your dominant pain</H3>
      <BulletList>
        <LI>
          <Strong>Cost obsession + Cloudflare-native</Strong>: Cloudflare AI
          Gateway.
        </LI>
        <LI>
          <Strong>Per-tenant controls + opinionated routing</Strong>: Portkey.
        </LI>
        <LI>
          <Strong>Observability-first</Strong>: Helicone.
        </LI>
        <LI>
          <Strong>Single API for many models, indie/consumer-facing</Strong>:
          OpenRouter.
        </LI>
      </BulletList>

      <H2>Examples in our index</H2>

      <Para>
        Gateway adoption is hard to surface as a single &quot;rollup&quot;
        because the gateway is the delivery path, not the model. We track it
        on each company&apos;s stack page in the evidence trail. Some of the
        public examples we&apos;ve documented:
      </Para>

      <BulletList>
        <LI>
          <CompanyChip slug="linear" name="Linear" /> — observable Cloudflare
          AI Gateway endpoints in their AI feature traffic.
        </LI>
        <LI>
          <CompanyChip slug="vercel" name="Vercel" /> — the AI SDK ships with
          a thin gateway pattern; we see multiple downstream providers.
        </LI>
        <LI>
          <CompanyChip slug="cursor" name="Cursor" /> — multi-provider routing
          observable from request body model names across sessions.
        </LI>
      </BulletList>

      <Methodology>
        <p>
          Gateway attribution is a two-step process: identify the gateway
          host (Tier 1) and then attribute the underlying provider from the
          request body, response framing, and SDK bundle (Tier 2 and Tier 3).
          When the underlying provider cannot be resolved above the 0.60
          confidence floor, we record the gateway only and mark the
          underlying provider as unknown.
        </p>
        <p>
          Adoption rate (~1 in 5 products) is the share of our SaaS index
          where at least one gateway hostname appears in the AI request
          path. This is a lower bound — self-rolled gateways at custom
          hostnames are not counted unless we can identify them by request
          shape.
        </p>
      </Methodology>
    </>
  );

  return (
    <BlogPostLayout
      slug="ai-gateways-explained-cloudflare-portkey-helicone"
      title="AI Gateways Explained: Cloudflare AI Gateway, Portkey, Helicone"
      description="What an AI gateway actually does, why ~1 in 5 SaaS products now use one, and how AIHackr fingerprints traffic that has been routed through them."
      publishedTime="2026-04-10T00:00:00Z"
      modifiedTime="2026-04-22T00:00:00Z"
      displayDate="April 2026"
      category="Infrastructure"
      keywords="AI gateway, Cloudflare AI Gateway, Portkey, Helicone, LLM gateway SaaS, what is AI gateway"
      related={{
        providers: [
          { name: "OpenAI", slug: "openai" },
          { name: "Anthropic", slug: "anthropic" },
        ],
        companies: [
          { name: "Linear", slug: "linear" },
          { name: "Vercel", slug: "vercel" },
          { name: "Cursor", slug: "cursor" },
        ],
        posts: [
          {
            title: "How to tell which LLM a website is using",
            slug: "how-to-tell-which-llm-a-website-is-using",
          },
          {
            title: "The complete guide to fingerprinting AI providers",
            slug: "the-complete-guide-to-fingerprinting-ai-providers",
          },
          {
            title: "OpenAI vs Anthropic: which SaaS uses which",
            slug: "openai-vs-anthropic-which-saas-companies-use-which",
          },
        ],
      }}
      body={body}
    />
  );
}
