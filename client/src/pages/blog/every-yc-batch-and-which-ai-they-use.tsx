import { BlogPostScaffold } from "@/components/blog-post";

export default function Post() {
  return (
    <BlogPostScaffold
      slug="every-yc-batch-and-which-ai-they-use"
      title="Every YC Batch and Which AI They Use"
      description="Cohort-by-cohort breakdown of AI provider choices across recent Y Combinator batches — what changes batch over batch."
      publishedTime="2026-04-14T00:00:00Z"
      displayDate="April 2026"
      category="YC Watch"
      keywords="YC AI startups, Y Combinator AI providers, YC batch tech stack, YC Anthropic, YC OpenAI"
      leads={[
        "YC batches are a useful leading indicator: founders defaulting to a provider tend to stay with it, and the cohort-over-cohort drift maps directly onto provider mindshare. We track every YC company in our index.",
      ]}
      sections={[
        {
          heading: "Cohort patterns we see",
          bullets: [
            "Recent batches: rising share of Anthropic + Bedrock, declining default-to-OpenAI.",
            "Earlier 2023 batches still skew heavily OpenAI direct.",
            "Code-tooling companies in any batch are the most likely to use multiple providers.",
          ],
        },
        {
          heading: "Most common stacks by batch",
          bullets: [
            "Next.js + Vercel + OpenAI is still the most common starter stack.",
            "Replacing Vercel with Cloudflare and OpenAI with Anthropic is the dominant migration path.",
          ],
        },
        {
          heading: "What founders should take from this",
          bullets: [
            "If you're picking a provider today, you're not locked in — most YC companies switch at least once.",
            "Pick a gateway early to make those switches non-events.",
          ],
        },
      ]}
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
          { title: "The State of AI in SaaS — 2026", slug: "the-state-of-ai-in-saas-2026" },
          { title: "AI Gateways Explained", slug: "ai-gateways-explained-cloudflare-portkey-helicone" },
        ],
      }}
    />
  );
}
