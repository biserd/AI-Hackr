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
  LiveCompaniesByProvider,
} from "@/components/blog-post";

export default function Post() {
  const body = (
    <>
      <Lead>
        AWS Bedrock has become the easiest path to production Claude for any
        team already on AWS — single bill, IAM, VPC endpoints, no new vendor
        onboarding. We track every product where Bedrock shows up in the wire
        signals. This page is the live list, refreshed continuously, plus the
        playbook for how we detect it.
      </Lead>

      <H2>Why Bedrock keeps winning enterprise AWS shops</H2>

      <Para>
        For a SaaS team that already runs on AWS, &quot;use Bedrock for
        Claude&quot; reduces a multi-quarter procurement project to a
        Wednesday afternoon configuration:
      </Para>

      <BulletList>
        <LI>
          <Strong>Single contract.</Strong> No new MSA with Anthropic. No new
          vendor in your security review.
        </LI>
        <LI>
          <Strong>IAM, not API keys.</Strong> Auth is your existing IAM
          principal. Rotate keys via your existing rotation, not a separate
          dashboard.
        </LI>
        <LI>
          <Strong>VPC + PrivateLink.</Strong> Inference traffic never leaves
          your account boundary if you don&apos;t want it to.
        </LI>
        <LI>
          <Strong>Single bill.</Strong> Inference spend lands on the same AWS
          invoice as the rest of your infra. No second cost-attribution
          system.
        </LI>
        <LI>
          <Strong>Compliance carryover.</Strong> Whatever Bedrock has been
          attested for under your existing AWS BAA, SOC 2, ISO, FedRAMP
          posture carries over.
        </LI>
      </BulletList>

      <H2>What runs on Bedrock</H2>

      <Para>
        Bedrock multiplexes several model families. The ones we see most in
        production SaaS, in order:
      </Para>

      <DataTable
        headers={["Model family", "Primary use cases in our index"]}
        rows={[
          [
            <Em key="r1">Anthropic Claude (3.5 / 3.7 / 4)</Em>,
            "Customer support, document Q&A, agents",
          ],
          [
            <Em key="r2">Meta Llama 3.1 70B / 3 8B</Em>,
            "Cheaper bulk completion, batch summarisation",
          ],
          [
            <Em key="r3">Amazon Titan</Em>,
            "Embeddings, sometimes chat in AWS-first products",
          ],
          [
            <Em key="r4">Mistral Large / Small</Em>,
            "Specialised retrieval and structured-output workloads",
          ],
          [
            <Em key="r5">Cohere Command R+ / Embed</Em>,
            "Embeddings and enterprise search",
          ],
        ]}
        caption="Bedrock-served model families ranked by frequency of detection in the AIHackr SaaS index."
      />

      <H2>Bedrock&apos;s detection fingerprint</H2>

      <H3>Tier 1 — hostnames</H3>
      <BulletList>
        <LI>
          <Code>bedrock-runtime.&lt;region&gt;.amazonaws.com</Code> — the
          synchronous + streaming inference endpoint.
        </LI>
        <LI>
          <Code>bedrock-agent-runtime.&lt;region&gt;.amazonaws.com</Code> — for
          Bedrock Agents and Knowledge Bases.
        </LI>
        <LI>
          <Code>bedrock.&lt;region&gt;.amazonaws.com</Code> — control plane
          (less commonly visible from a browser).
        </LI>
      </BulletList>

      <H3>Tier 2 — request shape</H3>
      <BulletList>
        <LI>
          AWS SigV4 signed Authorization header:{" "}
          <Code>AWS4-HMAC-SHA256 Credential=...</Code>.
        </LI>
        <LI>
          The model identifier appears in the URL path:{" "}
          <Code>/model/anthropic.claude-3-5-sonnet-20240620-v1:0/invoke</Code>{" "}
          or <Code>/model/meta.llama3-1-70b-instruct-v1:0/invoke</Code>.
        </LI>
        <LI>
          Streaming uses <Code>InvokeModelWithResponseStream</Code> over an
          AWS Eventstream — bytes-encoded chunks framed with a 12-byte prelude
          rather than SSE.
        </LI>
      </BulletList>

      <CodeBlock language="example">{`POST https://bedrock-runtime.us-east-1.amazonaws.com/model/anthropic.claude-3-5-sonnet-20240620-v1:0/invoke-with-response-stream
Authorization: AWS4-HMAC-SHA256 Credential=AKIA.../20260420/us-east-1/bedrock/aws4_request, ...
X-Amzn-Bedrock-Trace: ENABLED

{ "anthropic_version": "bedrock-2023-05-31", "messages": [...] }`}</CodeBlock>

      <H3>Tier 3 — corroboration</H3>
      <BulletList>
        <LI>
          AWS SDK fingerprints in JS bundles (<Code>@aws-sdk/client-bedrock-runtime</Code>).
        </LI>
        <LI>
          Vendor mentions in trust pages (&quot;hosted on AWS Bedrock&quot;).
        </LI>
        <LI>
          Cost-attribution dashboards we sometimes see leak in admin UIs.
        </LI>
      </BulletList>

      <Callout tone="info" title="Why Bedrock often hides behind a backend">
        Most Bedrock traffic is server-side, not browser-side. We detect it
        most reliably when the SaaS proxies the streaming response through
        their own backend with a recognisable framing (Eventstream chunks,
        Bedrock-specific JSON keys like <Code>amazon-bedrock-invocationMetrics</Code>{" "}
        leaking through). When a product fully hides Bedrock behind a clean
        OpenAI-compatible proxy, we may classify them as &quot;unknown&quot;
        rather than mis-attribute them.
      </Callout>

      <H2>What Bedrock customers tend to have in common</H2>

      <OrderedList>
        <LI>
          <Strong>Heavy existing AWS footprint.</Strong> RDS, S3, VPC, Lambda
          — they have already paid the AWS-everything tax and want one more
          thing on the same bill.
        </LI>
        <LI>
          <Strong>Compliance teams that have already approved AWS.</Strong>{" "}
          The BAA, the SOC 2 sub-processor list, the FedRAMP boundary — all
          of it is reusable.
        </LI>
        <LI>
          <Strong>A specific need for Anthropic models inside their AWS
          account boundary.</Strong> Often driven by a regulated customer or a
          data-residency requirement.
        </LI>
        <LI>
          <Strong>Engineering culture that prefers IAM over API keys.</Strong>{" "}
          Teams that already think of credentials as IAM principals find
          Bedrock&apos;s auth model more natural than OpenAI&apos;s.
        </LI>
      </OrderedList>

      <H2>The live list</H2>

      <Para>
        Below is the current set of products in our index whose primary AI
        provider attribution is AWS Bedrock. The list refreshes on the
        weekly scan cycle.
      </Para>

      <LiveCompaniesByProvider
        provider="AWS Bedrock"
        emptyText="No products currently fingerprinted on Bedrock as the primary provider — most Bedrock traffic in our index sits behind a backend proxy. See the live secondary detections below."
      />

      <H2>Hybrid: Bedrock + something else</H2>

      <Para>
        Many products in our index use Bedrock <Em>and</Em> something else.
        The most common patterns:
      </Para>

      <DataTable
        headers={["Pattern", "Why"]}
        rows={[
          [
            <Em key="r1">Bedrock for enterprise tier, OpenAI direct for free</Em>,
            "Compliance-gated SKUs need Bedrock; cost optimisation on free tier prefers OpenAI Mini.",
          ],
          [
            <Em key="r2">Bedrock for chat, Cohere/embeddings provider for retrieval</Em>,
            "Bedrock&apos;s embedding story is OK but Cohere/Voyage often beat it on quality at the same price.",
          ],
          [
            <Em key="r3">Bedrock with multi-region failover</Em>,
            "Larger SaaS use Bedrock in two AWS regions for inference HA without leaving AWS.",
          ],
          [
            <Em key="r4">Bedrock + self-hosted Llama</Em>,
            "Self-hosted for latency-critical or fine-tuned workloads, Bedrock for everything else.",
          ],
        ]}
      />

      <H2>How to evaluate Bedrock for your own product</H2>

      <BulletList>
        <LI>
          You are already on AWS. (If you aren&apos;t, the answer is almost
          always Anthropic direct or OpenAI direct.)
        </LI>
        <LI>
          You need Claude (or Llama, or Titan) inside your VPC, or your
          customers are about to ask for that.
        </LI>
        <LI>
          You can tolerate Bedrock&apos;s sometimes-slow region rollout for
          new model versions.
        </LI>
        <LI>
          You are willing to accept that Bedrock&apos;s SDK and API
          ergonomics are noticeably worse than Anthropic&apos;s direct SDK.
        </LI>
      </BulletList>

      <Methodology>
        <p>
          Bedrock attribution requires either a Tier 1 hostname (
          <Code>bedrock-runtime.*</Code> in fetch/XHR) or a Tier 2 schema
          signature (Eventstream framing + Bedrock-specific JSON keys
          surfaced through a backend proxy) above the 0.60 confidence floor.
          We resolve the underlying model family from the path-embedded
          model identifier when present, and from the request body otherwise.
        </p>
        <p>
          Because most Bedrock traffic is server-side, our index
          under-counts Bedrock attributions relative to its true production
          footprint. Treat the live list as a lower bound.
        </p>
      </Methodology>
    </>
  );

  return (
    <BlogPostLayout
      slug="aws-bedrock-customers-the-complete-list"
      title="AWS Bedrock Customers: The Complete List"
      description="Every SaaS product AIHackr has detected running Anthropic, Llama, or Titan models through AWS Bedrock — refreshed weekly, with the detection playbook."
      publishedTime="2026-04-13T00:00:00Z"
      modifiedTime="2026-04-22T00:00:00Z"
      displayDate="April 2026"
      category="Provider Spotlight"
      keywords="AWS Bedrock customers, Bedrock SaaS, who uses AWS Bedrock, Bedrock Anthropic customers, Bedrock Claude"
      related={{
        providers: [
          { name: "AWS Bedrock", slug: "aws-bedrock" },
          { name: "Anthropic", slug: "anthropic" },
          { name: "Meta Llama", slug: "meta-llama" },
        ],
        companies: [
          { name: "Stripe", slug: "stripe" },
          { name: "Datadog", slug: "datadog" },
        ],
        posts: [
          {
            title: "Azure OpenAI adoption in enterprise SaaS",
            slug: "azure-openai-adoption-in-enterprise-saas",
          },
          {
            title: "Claude vs GPT-4: real-world deployments",
            slug: "claude-vs-gpt-4-real-world-saas-deployments",
          },
          {
            title: "How to tell which LLM a website is using",
            slug: "how-to-tell-which-llm-a-website-is-using",
          },
        ],
      }}
      body={body}
    />
  );
}
