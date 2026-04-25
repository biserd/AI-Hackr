import { BlogPostScaffold } from "@/components/blog-post";

export default function Post() {
  return (
    <BlogPostScaffold
      slug="self-hosted-llms-which-saas-products-run-their-own-models"
      title="Self-Hosted LLMs: Which SaaS Products Run Their Own Models"
      description="The list of SaaS products quietly running open-weight Llama, Mistral, and fine-tuned derivatives in production — and why."
      publishedTime="2026-04-12T00:00:00Z"
      displayDate="April 2026"
      category="Infrastructure"
      keywords="self-hosted LLM, Llama production, Mistral production, open weights SaaS, self-hosted AI customers"
      leads={[
        "Two years ago, 'self-hosted LLM in production' was almost an oxymoron for SaaS. Today it's a deliberate cost and differentiation play, and we can see it in the wire traffic.",
      ]}
      sections={[
        {
          heading: "Detection signals for self-hosted",
          bullets: [
            "AI calls hit the product's own apex domain or a private subdomain (e.g., inference.example.com).",
            "No traffic to api.openai.com / api.anthropic.com / *.azure.com / *.bedrock.aws.",
            "Sometimes vLLM, TGI, or Triton-flavored response headers leak through.",
          ],
        },
        {
          heading: "Why teams self-host",
          bullets: [
            "Cost — once volume crosses ~$30k/month, fine-tuned 7B/13B models often beat hosted on price/performance.",
            "Latency — co-located inference with the product database.",
            "Differentiation — proprietary fine-tunes that can't be replicated by a frontier API.",
          ],
        },
        {
          heading: "What we see most often",
          bullets: [
            "Llama 3.1 70B and Llama 3 8B fine-tunes for chat surfaces.",
            "Mistral and Mixtral derivatives for retrieval and structured-output workloads.",
            "Hybrid setups: hosted frontier model for premium tiers, self-hosted for free/internal.",
          ],
        },
      ]}
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
          { title: "The State of AI in SaaS — 2026", slug: "the-state-of-ai-in-saas-2026" },
          { title: "The complete guide to fingerprinting AI providers", slug: "the-complete-guide-to-fingerprinting-ai-providers" },
        ],
      }}
    />
  );
}
