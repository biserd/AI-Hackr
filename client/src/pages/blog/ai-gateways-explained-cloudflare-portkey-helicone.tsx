import { BlogPostScaffold } from "@/components/blog-post";

export default function Post() {
  return (
    <BlogPostScaffold
      slug="ai-gateways-explained-cloudflare-portkey-helicone"
      title="AI Gateways Explained: Cloudflare AI Gateway, Portkey, Helicone"
      description="What an AI gateway actually does, why ~1 in 5 SaaS products now use one, and how AIHackr fingerprints traffic that's been routed through them."
      publishedTime="2026-04-10T00:00:00Z"
      displayDate="April 2026"
      category="Infrastructure"
      keywords="AI gateway, Cloudflare AI Gateway, Portkey, Helicone, LLM gateway SaaS, what is AI gateway"
      leads={[
        "An AI gateway sits between your application and your LLM provider, handling caching, rate limits, fallbacks, observability, and provider routing. Two years ago they were niche; today they're showing up in roughly 20% of the products we scan.",
      ]}
      sections={[
        {
          heading: "Why teams adopt a gateway",
          bullets: [
            "Multi-provider routing — fallback from OpenAI to Anthropic on rate-limit or quality failures.",
            "Cost controls — semantic caching and per-tenant budgets.",
            "Observability — request-level traces without rolling your own.",
            "Compliance — single chokepoint for redaction and audit.",
          ],
        },
        {
          heading: "Detection signatures we use",
          bullets: [
            "Cloudflare AI Gateway: gateway.ai.cloudflare.com URLs.",
            "Portkey: api.portkey.ai or x-portkey-* headers.",
            "Helicone: oai.helicone.ai or oai.hconeai.com proxy hostnames.",
            "OpenRouter: openrouter.ai with multi-provider routing parameters.",
          ],
        },
        {
          heading: "What gateways break — and how to see through them",
          bullets: [
            "Naïve hostname-only detection misclassifies all gateway traffic as 'gateway' instead of attributing the underlying provider.",
            "AIHackr falls back to request body schemas, model-name strings, and response shapes to attribute the real provider.",
          ],
        },
      ]}
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
          { title: "How to tell which LLM a website is using", slug: "how-to-tell-which-llm-a-website-is-using" },
          { title: "The complete guide to fingerprinting AI providers", slug: "the-complete-guide-to-fingerprinting-ai-providers" },
        ],
      }}
    />
  );
}
