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
        Two years ago, &quot;self-hosted LLM in production&quot; was almost
        an oxymoron for SaaS. Today it is a deliberate cost and
        differentiation play, and we can see it in the wire traffic. This is
        what we know about which SaaS products are running their own models,
        why they bother, and how to detect it from outside.
      </Lead>

      <H2>What &quot;self-hosted&quot; actually means in 2026</H2>

      <Para>
        We use a strict definition. A product is self-hosted if its AI
        inference traffic does <Em>not</Em> touch any of the recognised
        provider hostnames — no <Code>api.openai.com</Code>, no{" "}
        <Code>api.anthropic.com</Code>, no <Code>*.azure.com</Code>, no{" "}
        <Code>bedrock-runtime.*.amazonaws.com</Code>, no recognisable
        gateway. The inference call lands on the product&apos;s own apex or
        a private subdomain. The model is theirs to operate.
      </Para>

      <Para>
        This is a much higher bar than &quot;we fine-tuned on top of an
        open model.&quot; A team that fine-tunes Llama and serves it through
        Together AI or Replicate is still a hosted-inference customer. Only
        the teams running their own GPUs or their own dedicated instances
        count as self-hosted in our taxonomy.
      </Para>

      <H2>Detection signals for self-hosted</H2>

      <H3>Tier 1 — what&apos;s missing</H3>
      <BulletList>
        <LI>
          No traffic to <Code>api.openai.com</Code>,{" "}
          <Code>api.anthropic.com</Code>, <Code>*.openai.azure.com</Code>,{" "}
          <Code>bedrock-runtime.*.amazonaws.com</Code>.
        </LI>
        <LI>
          No traffic to recognised gateways (<Code>gateway.ai.cloudflare.com</Code>
          , <Code>api.portkey.ai</Code>, <Code>oai.helicone.ai</Code>,{" "}
          <Code>openrouter.ai</Code>).
        </LI>
        <LI>
          AI calls hit the product&apos;s own apex domain or a private
          subdomain (<Code>inference.example.com</Code>,{" "}
          <Code>ai.example.com</Code>).
        </LI>
      </BulletList>

      <H3>Tier 2 — telltale serving stacks</H3>
      <BulletList>
        <LI>
          <Code>vllm</Code> response headers (<Code>x-vllm-version</Code>,
          OpenAI-compatible API at a private host).
        </LI>
        <LI>
          Hugging Face Text Generation Inference (TGI) shape — its own
          response framing for streaming.
        </LI>
        <LI>
          NVIDIA Triton headers (<Code>x-trt-llm-*</Code>) or the gRPC
          tensor schema leaking through a JSON proxy.
        </LI>
        <LI>
          Custom OpenAI-compatible endpoints with model names that don&apos;t
          map to any frontier provider — <Code>llama-3.1-70b-instruct</Code>,{" "}
          <Code>mistral-7b-finetune-v3</Code>, etc.
        </LI>
      </BulletList>

      <H3>Tier 3 — corroborating signals</H3>
      <BulletList>
        <LI>
          Job listings mentioning vLLM, TGI, Triton, A100, H100.
        </LI>
        <LI>
          Engineering blogs about inference optimisation.
        </LI>
        <LI>
          Status pages with &quot;inference cluster&quot; as a separate
          component.
        </LI>
      </BulletList>

      <Callout tone="info" title="Hybrid is the most common pattern">
        Almost no SaaS in our index runs <Em>only</Em> self-hosted. The
        common shape is a hosted frontier model for premium tiers and
        complex tasks, plus a self-hosted Llama or Mistral for free tiers,
        bulk batch jobs, or latency-critical surfaces.
      </Callout>

      <H2>Why teams self-host in 2026</H2>

      <H3>1. Unit economics past a threshold</H3>
      <Para>
        Once a product crosses roughly $30,000/month in inference spend on a
        well-defined workload, fine-tuned 7B–13B models on dedicated
        instances often beat hosted-frontier on price/performance. The
        switch is not free — operations, evaluation, and on-call get
        real — but the savings are visible in the gross margin.
      </Para>

      <H3>2. Latency that beats a network hop</H3>
      <Para>
        Co-locating inference with the product database eliminates the
        round-trip to a hosted provider. For latency-sensitive surfaces —
        autocomplete, typing-feel features, real-time UX — sub-50ms p50 is
        only achievable in-VPC. We see this most in code-tooling, IDE-shaped
        products, and search-typeahead surfaces.
      </Para>

      <H3>3. Differentiation via fine-tuning</H3>
      <Para>
        A model trained on your proprietary data is a model your competitors
        cannot replicate by switching to the same hosted provider. Customer
        support tools, sales-call summarisers, and domain-specific
        copilots increasingly self-host the fine-tune that captures their
        moat.
      </Para>

      <H3>4. Compliance and data sovereignty</H3>
      <Para>
        For workloads that legally cannot leave a customer&apos;s
        infrastructure (regulated finance, defence, certain healthcare),
        self-hosted on the customer&apos;s VPC is the only acceptable
        architecture. We see this in the highest-end enterprise SKUs.
      </Para>

      <H2>What we see most often in production</H2>

      <DataTable
        headers={["Model family", "Typical use", "Operational tier"]}
        rows={[
          [
            <Em key="r1">Llama 3.1 70B Instruct</Em>,
            "Chat surfaces, support replies",
            "Multi-GPU instances (often 4×H100)",
          ],
          [
            <Em key="r2">Llama 3 8B / 3.1 8B</Em>,
            "High-volume completion, classification",
            "Single GPU, often A10G or L4",
          ],
          [
            <Em key="r3">Mistral 7B fine-tunes</Em>,
            "Retrieval, structured output",
            "Single GPU; cheap to keep warm",
          ],
          [
            <Em key="r4">Mixtral 8x7B / 8x22B</Em>,
            "Mid-tier reasoning, longer-context Q&A",
            "Multi-GPU MoE inference",
          ],
          [
            <Em key="r5">Custom fine-tunes (3B–13B)</Em>,
            "Domain-specific tasks (support, sales, legal)",
            "Single or dual GPU; small batch latency optimised",
          ],
        ]}
        caption="The self-hosted production stack we see across the AIHackr SaaS index."
      />

      <H2>Where we&apos;ve seen self-hosting in our index</H2>

      <Para>
        Hard-attribution &quot;they self-host&quot; from the outside is
        difficult — many self-hosted setups look like an internal API to
        passive observation. We are conservative and only count companies
        where multiple Tier 2 signals fire. Examples we&apos;ve documented
        include:
      </Para>

      <BulletList>
        <LI>
          <CompanyChip slug="replit" name="Replit" /> — runs its own model
          for code intelligence in the IDE alongside hosted frontier models
          for the chat surfaces.
        </LI>
        <LI>
          <CompanyChip slug="perplexity" name="Perplexity" /> — operates
          significant in-house inference for the search-synthesis surface,
          with hosted frontier as one of the routed-to options.
        </LI>
        <LI>
          Several search and retrieval products in our index serve
          embeddings from in-VPC models (vLLM-shaped responses on private
          hostnames) rather than calling a hosted embedding provider.
        </LI>
      </BulletList>

      <Para>
        This list will grow as we get better at fingerprinting in-VPC
        inference from outside; track the live list on the{" "}
        <Link href="/leaderboard" className="text-primary hover:underline">
          leaderboard
        </Link>{" "}
        and the relevant{" "}
        <Link href="/stack" className="text-primary hover:underline">
          stack pages
        </Link>
        .
      </Para>

      <H2>The hidden second-order costs nobody talks about</H2>

      <Para>
        The math people do before self-hosting is usually GPU rental cost
        per hour times utilization, compared against per-token API
        pricing. That math is correct, and it usually says self-hosting
        wins above some threshold. But it leaves out three line items
        that we have watched eat the savings of more than one team in
        our index.
      </Para>

      <Para>
        First: the eval pipeline. Hosted providers ship model upgrades
        that quietly improve quality on the same prompt. When you
        self-host, that improvement is your job. Standing up a regression
        eval suite that runs against every weight update — and gating
        deploys on it — is a multi-engineer-quarter project, and you
        cannot skip it without shipping silent regressions to users.
      </Para>

      <Para>
        Second: GPU procurement. Spot pricing is great until your
        availability zone runs out of H100s on a Tuesday afternoon. The
        teams we see actually saving money have either reserved capacity
        contracts or have built failover to an inference partner like
        Together, Anyscale, or Fireworks for the moments when their
        primary cluster cannot scale. That fallback path is operationally
        non-trivial and rarely shows up in the original cost model.
      </Para>

      <Para>
        Third: the &quot;we should fine-tune&quot; black hole. Once you
        own the weights, every product manager has an opinion about how
        the model should behave on their feature. Without strict
        prioritization, you end up running ten fine-tunes for ten
        product surfaces, each requiring its own eval, each adding a
        forward-deployable variant to manage. The teams that beat the
        unit economics keep the fine-tune count small (one or two) and
        push the rest into prompt engineering against the base model.
      </Para>

      <H2>Should you self-host?</H2>

      <H3>You probably should if</H3>
      <BulletList>
        <LI>
          You spend more than $30,000/month on a well-defined inference
          workload that hasn&apos;t changed shape in months.
        </LI>
        <LI>
          You have a compelling fine-tune (or could build one) on your own
          data that meaningfully beats the hosted alternative.
        </LI>
        <LI>
          You need sub-50ms p50 inference latency that a hosted API
          can&apos;t hit.
        </LI>
        <LI>
          You sell into customers who require their data not to leave their
          infrastructure.
        </LI>
      </BulletList>

      <H3>You probably shouldn&apos;t if</H3>
      <BulletList>
        <LI>
          You can&apos;t answer &quot;what is our p99 latency target&quot;
          and &quot;what is our peak QPS in tokens/second&quot; off the top
          of your head.
        </LI>
        <LI>
          Your workload changes prompt shape monthly — the eval cost will
          eat the savings.
        </LI>
        <LI>
          You&apos;d be staffing a dedicated inference SRE for one product
          surface.
        </LI>
        <LI>
          Your inference spend is below $10k/month — the operational
          break-even isn&apos;t there.
        </LI>
      </BulletList>

      <H2>Provider rollups for self-hosted-relevant model families</H2>
      <ProviderChipRow
        items={[
          { name: "Meta Llama", slug: "meta-llama" },
          { name: "Mistral", slug: "mistral" },
          { name: "AWS Bedrock", slug: "aws-bedrock" },
        ]}
      />

      <Methodology>
        <p>
          Self-hosted attribution is the strictest tier in our taxonomy. We
          require: (a) zero detected traffic to recognised provider or
          gateway hostnames, (b) at least one Tier 2 signal indicating an
          in-house inference stack (vLLM, TGI, Triton, or an
          OpenAI-compatible response with non-frontier model identifiers),
          and (c) corroborating context from public artefacts (engineering
          blogs, job listings, status pages) to rule out unattributed
          hosted inference.
        </p>
        <p>
          Hybrid stacks count as self-hosted only if the self-hosted path is
          the primary serving surface for the dominant traffic class. A
          fine-tune served behind Together AI or Replicate is a
          hosted-inference attribution, not self-hosted.
        </p>
      </Methodology>
    </>
  );

  return (
    <BlogPostLayout
      slug="self-hosted-llms-which-saas-products-run-their-own-models"
      title="Self-Hosted LLMs: Which SaaS Products Run Their Own Models"
      description="The list of SaaS products quietly running open-weight Llama, Mistral, and fine-tuned derivatives in production — with detection signals, economics, and the production stack we see."
      publishedTime="2026-04-12T00:00:00Z"
      modifiedTime="2026-04-22T00:00:00Z"
      displayDate="April 2026"
      category="Infrastructure"
      keywords="self-hosted LLM, Llama production, Mistral production, open weights SaaS, self-hosted AI customers"
      related={{
        providers: [
          { name: "Meta Llama", slug: "meta-llama" },
          { name: "Mistral", slug: "mistral" },
        ],
        companies: [
          { name: "Replit", slug: "replit" },
          { name: "Perplexity", slug: "perplexity" },
        ],
        posts: [
          {
            title: "The State of AI in SaaS — 2026",
            slug: "the-state-of-ai-in-saas-2026",
          },
          {
            title: "The complete guide to fingerprinting AI providers",
            slug: "the-complete-guide-to-fingerprinting-ai-providers",
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
