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
        If you have ever wanted to know whether a chatbot was actually
        running GPT-4 or quietly serving a fine-tuned Llama, here is the
        playbook. None of this requires special access — just devtools, a
        careful eye, and the willingness to read a streaming response on
        the wire. This is the same checklist AIHackr uses internally,
        distilled for one-time investigations.
      </Lead>

      <Callout tone="info" title="Use this responsibly">
        Everything below is passive — you are reading what a website&apos;s
        own product surfaces to your browser. Don&apos;t do anything you
        wouldn&apos;t do if the site&apos;s engineer were watching. AIHackr
        only ever reads what an anonymous user can see.
      </Callout>

      <H2>Step 1: open the network tab and trigger an AI response</H2>

      <OrderedList>
        <LI>
          Open Chrome or Firefox devtools, switch to the{" "}
          <Strong>Network</Strong> tab, and filter by <Code>Fetch/XHR</Code>.
        </LI>
        <LI>
          Clear the existing entries.
        </LI>
        <LI>
          Trigger an AI response — type into the chat, click the
          &quot;summarise&quot; button, or whatever the surface is.
        </LI>
        <LI>
          Look for a request with a streaming response (the size will keep
          ticking up; the duration will stay open). That is almost always
          the LLM call.
        </LI>
      </OrderedList>

      <H2>Step 2: read the request host</H2>

      <Para>
        The host of the streaming/POST request is your first and strongest
        signal. It is rarely faked because the cost of running a custom
        proxy on the same hostname adds operational complexity for no
        marketing benefit.
      </Para>

      <DataTable
        headers={["Hostname", "What it means"]}
        rows={[
          [<Code key="r1a">api.openai.com</Code>, "OpenAI direct"],
          [<Code key="r2a">api.anthropic.com</Code>, "Anthropic direct"],
          [
            <Code key="r3a">*.openai.azure.com</Code>,
            "Azure OpenAI",
          ],
          [
            <Code key="r4a">*.cognitiveservices.azure.com</Code>,
            "Azure (older Cognitive Services pattern)",
          ],
          [
            <Code key="r5a">bedrock-runtime.*.amazonaws.com</Code>,
            "AWS Bedrock",
          ],
          [
            <Code key="r6a">generativelanguage.googleapis.com</Code>,
            "Google Gemini",
          ],
          [
            <Code key="r7a">api.mistral.ai</Code>,
            "Mistral La Plateforme",
          ],
          [
            <Code key="r8a">api.cohere.com</Code>,
            "Cohere",
          ],
          [
            <Code key="r9a">gateway.ai.cloudflare.com</Code>,
            "Cloudflare AI Gateway (sees through to provider)",
          ],
          [
            <Code key="r10a">api.portkey.ai</Code>,
            "Portkey gateway",
          ],
          [
            <Code key="r11a">oai.helicone.ai / oai.hconeai.com</Code>,
            "Helicone proxy (sees through to OpenAI by default)",
          ],
          [
            <Code key="r12a">openrouter.ai</Code>,
            "OpenRouter aggregator",
          ],
          [
            <Em key="r13a">Apex domain or private subdomain</Em>,
            "Likely self-hosted, gateway-hidden, or backend-proxied",
          ],
        ]}
        caption="The most common LLM hostnames you&apos;ll see in production fetch/XHR traffic."
      />

      <H2>Step 3: check the request and response shape</H2>

      <Para>
        The hostname pins the delivery path. The request and response shape
        pin the underlying provider — important when traffic goes through a
        gateway or a backend proxy. Here is what to look for.
      </Para>

      <H3>OpenAI shape</H3>
      <BulletList>
        <LI>
          Auth header: <Code>Authorization: Bearer sk-...</Code>
        </LI>
        <LI>
          Request body: top-level <Code>messages</Code> array with{" "}
          <Code>role</Code>/<Code>content</Code>; usually a{" "}
          <Code>model</Code> string like <Code>gpt-4o</Code>.
        </LI>
        <LI>
          Streaming response: SSE chunks with{" "}
          <Code>data: &#123;&quot;choices&quot;: [&#123;&quot;delta&quot;: &#123;&quot;content&quot;: &quot;...&quot;&#125;&#125;]&#125;</Code>
        </LI>
        <LI>
          Final chunk: <Code>data: [DONE]</Code>.
        </LI>
      </BulletList>

      <H3>Anthropic shape</H3>
      <BulletList>
        <LI>
          Auth header: <Code>x-api-key: ...</Code> plus{" "}
          <Code>anthropic-version: 2023-06-01</Code>.
        </LI>
        <LI>
          Request body: top-level <Code>messages</Code>{" "}
          <Em>and</Em> a separate top-level <Code>system</Code> field
          (OpenAI puts system in the messages array; Anthropic doesn&apos;t).
        </LI>
        <LI>
          Streaming response: SSE events named{" "}
          <Code>message_start</Code>, <Code>content_block_delta</Code>,{" "}
          <Code>content_block_stop</Code>, <Code>message_stop</Code>.
        </LI>
      </BulletList>

      <H3>Azure OpenAI shape</H3>
      <BulletList>
        <LI>
          Auth header: <Code>api-key: ...</Code> (note: not Bearer).
        </LI>
        <LI>
          URL path: <Code>/openai/deployments/&lt;name&gt;/chat/completions</Code>{" "}
          with an <Code>api-version=YYYY-MM-DD-preview</Code> query string.
        </LI>
        <LI>
          Response shape: identical to OpenAI direct (same SSE delta format).
        </LI>
      </BulletList>

      <H3>AWS Bedrock shape</H3>
      <BulletList>
        <LI>
          Auth header: <Code>Authorization: AWS4-HMAC-SHA256 ...</Code> (SigV4).
        </LI>
        <LI>
          URL path includes the model identifier:{" "}
          <Code>/model/anthropic.claude-3-5-sonnet-20240620-v1:0/invoke-with-response-stream</Code>
          .
        </LI>
        <LI>
          Streaming response: AWS Eventstream framing — bytes chunks with a
          12-byte prelude, not SSE.
        </LI>
      </BulletList>

      <CodeBlock language="example">{`# OpenAI streaming chunk
data: {"choices":[{"index":0,"delta":{"content":" hello"}}],"id":"chatcmpl-...","object":"chat.completion.chunk"}

# Anthropic streaming chunk
event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" hello"}}

# Bedrock chunk (Eventstream binary; this is the parsed JSON inside)
{":content-type":"application/json","bytes":"eyJkZWx0YSI6ey..."}`}</CodeBlock>

      <H2>Step 4: handle gateways</H2>

      <Para>
        If the host is a gateway (Cloudflare, Portkey, Helicone, OpenRouter),
        the body usually still names the underlying model. Look for the{" "}
        <Code>model</Code> field in the request body:
      </Para>

      <BulletList>
        <LI>
          <Code>gpt-4o</Code>, <Code>gpt-4</Code>, <Code>gpt-4o-mini</Code>{" "}
          → underlying provider is OpenAI (direct or Azure).
        </LI>
        <LI>
          <Code>claude-3-5-sonnet-20240620</Code>,{" "}
          <Code>claude-3-haiku</Code>, <Code>claude-4-opus</Code> →
          Anthropic (direct or via Bedrock).
        </LI>
        <LI>
          <Code>anthropic.claude-...</Code>,{" "}
          <Code>meta.llama3-...</Code>, <Code>amazon.titan-...</Code> →
          Bedrock-flavoured.
        </LI>
        <LI>
          Anything that doesn&apos;t look like a frontier-provider model
          name → likely self-hosted or fine-tuned.
        </LI>
      </BulletList>

      <Callout tone="warning" title="When the model name is hidden">
        A small share of products strip the model name from outbound requests
        at their backend. If the hostname is a gateway and the model field
        is absent or generic (<Code>auto</Code>, <Code>default</Code>), you
        cannot attribute the underlying provider from passive observation.
        Move on to step 5.
      </Callout>

      <H2>Step 5: check the JS bundle for SDK signatures</H2>

      <Para>
        When the wire traffic is ambiguous, the JS bundle often gives it
        away. Open the <Strong>Sources</Strong> tab, find the main app
        bundle, and search for vendor strings:
      </Para>

      <BulletList>
        <LI>
          <Code>openai</Code>, <Code>OpenAI(</Code> → official OpenAI SDK.
        </LI>
        <LI>
          <Code>@anthropic-ai/sdk</Code>, <Code>Anthropic(</Code> →
          Anthropic SDK.
        </LI>
        <LI>
          <Code>@aws-sdk/client-bedrock-runtime</Code> → Bedrock SDK
          (rare in browser bundles, but it happens).
        </LI>
        <LI>
          <Code>generativelanguage.googleapis.com</Code> hardcoded → Gemini.
        </LI>
        <LI>
          <Code>vercel/ai</Code> or <Code>ai/react</Code> → Vercel AI SDK,
          which can route to multiple providers.
        </LI>
      </BulletList>

      <H2>Step 6: handle &quot;backend-proxied&quot; products</H2>

      <Para>
        Some products do all AI calls server-side and expose only their own
        endpoint to the browser (e.g.,{" "}
        <Code>POST /api/chat</Code> on the product&apos;s own domain). In
        these cases you cannot directly attribute a provider from the wire.
        Three workarounds:
      </Para>

      <OrderedList>
        <LI>
          <Strong>Response framing.</Strong> If the proxy passes the
          provider&apos;s SSE format through, the response shape gives it
          away (OpenAI <Code>delta.content</Code> vs Anthropic{" "}
          <Code>content_block_delta</Code>).
        </LI>
        <LI>
          <Strong>Latency fingerprint.</Strong> Steady ~25–40 tokens/sec is
          OpenAI-class behaviour; bursty 60+ tokens/sec early followed by a
          drop is Anthropic-shaped on certain models. Not definitive but
          corroborating.
        </LI>
        <LI>
          <Strong>Public attestation.</Strong> Trust pages, security pages,
          job postings, and engineering blog posts often say outright. We
          rank these as Tier 3 evidence — useful for corroboration, never
          for sole attribution.
        </LI>
      </OrderedList>

      <H2>Step 7: validate against AIHackr</H2>

      <Para>
        Paste the URL into AIHackr and we will run our scanner against the
        same surface you just inspected. Two outcomes are useful:
      </Para>

      <BulletList>
        <LI>
          <Strong>We agree:</Strong> high-confidence attribution, you can
          stop there.
        </LI>
        <LI>
          <Strong>We disagree:</Strong> the evidence trail will show you
          which signals we relied on. Often the difference is that one of
          us is looking at a different code path (logged-out vs logged-in,
          marketing page vs product surface).
        </LI>
      </BulletList>

      <H2>Worked examples</H2>

      <H3>A SaaS chat surface</H3>
      <Para>
        You open a product, type into the chat, see a streaming POST to{" "}
        <Code>api.openai.com/v1/chat/completions</Code>. The request body
        has <Code>&quot;model&quot;: &quot;gpt-4o&quot;</Code> and{" "}
        <Code>Authorization: Bearer sk-...</Code>. Response is OpenAI SSE.
        Verdict: OpenAI direct, model GPT-4o. Confidence: high.
      </Para>

      <H3>A SaaS chat surface behind a gateway</H3>
      <Para>
        You open a product, type into the chat, see a streaming POST to{" "}
        <Code>gateway.ai.cloudflare.com/v1/&lt;account&gt;/.../openai/chat/completions</Code>
        . Body has <Code>&quot;model&quot;: &quot;claude-3-5-sonnet-20240620&quot;</Code>
        . Verdict: Cloudflare AI Gateway as delivery path; underlying
        provider is Anthropic. Confidence: high.
      </Para>

      <H3>A backend-proxied product</H3>
      <Para>
        You open a product, type into the chat, see a streaming POST to{" "}
        <Code>example.com/api/chat</Code>. The response is SSE with{" "}
        <Code>content_block_delta</Code> events leaking through.
        Verdict: backend proxy, but the underlying provider is Anthropic.
        Confidence: medium.
      </Para>

      <H2>What to do with the answer</H2>

      <BulletList>
        <LI>
          For a competitor: cross-reference against their pricing tiers and
          inferred margins. Frontier providers cost more per token than
          self-hosted; the choice tells you about their unit economics.
        </LI>
        <LI>
          For a vendor you&apos;re evaluating: ask them directly. The
          fingerprint gives you the &quot;how do you know?&quot; for the
          conversation.
        </LI>
        <LI>
          For your own product: run this on your own SaaS occasionally. We
          have seen teams discover a stale SDK pinned to a deprecated model
          because the wire format quietly changed.
        </LI>
      </BulletList>

      <Methodology>
        <p>
          This guide describes the same Tier 1 / Tier 2 / Tier 3 signal
          hierarchy AIHackr uses internally — see{" "}
          <Link
            href="/blog/the-complete-guide-to-fingerprinting-ai-providers"
            className="text-primary hover:underline"
          >
            The Complete Guide to Fingerprinting AI Providers
          </Link>{" "}
          for the full scoring rubric. We never collapse a Tier 3 hit into
          a high-confidence label, and we apply a 0.60 confidence floor
          before declaring a provider &quot;present&quot; on a product.
        </p>
      </Methodology>
    </>
  );

  return (
    <BlogPostLayout
      slug="how-to-tell-which-llm-a-website-is-using"
      title="How to Tell Which LLM a Website Is Using"
      description="A practical, evidence-based guide to fingerprinting any website&apos;s AI provider — devtools, request shapes, gateway tricks, and the same checklist AIHackr uses."
      publishedTime="2026-04-16T00:00:00Z"
      modifiedTime="2026-04-22T00:00:00Z"
      displayDate="April 2026"
      category="How-to"
      keywords="how to tell which AI a website uses, LLM detection, fingerprint AI provider, what AI does this site use, devtools LLM"
      related={{
        providers: [
          { name: "OpenAI", slug: "openai" },
          { name: "Anthropic", slug: "anthropic" },
          { name: "Azure OpenAI", slug: "azure-openai" },
          { name: "AWS Bedrock", slug: "aws-bedrock" },
        ],
        companies: [
          { name: "Notion", slug: "notion" },
          { name: "Intercom", slug: "intercom" },
          { name: "Cursor", slug: "cursor" },
        ],
        posts: [
          {
            title: "The complete guide to fingerprinting AI providers",
            slug: "the-complete-guide-to-fingerprinting-ai-providers",
          },
          {
            title: "AI Gateways Explained",
            slug: "ai-gateways-explained-cloudflare-portkey-helicone",
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
