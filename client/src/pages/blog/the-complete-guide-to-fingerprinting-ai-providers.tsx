import { BlogPostScaffold } from "@/components/blog-post";

export default function Post() {
  return (
    <BlogPostScaffold
      slug="the-complete-guide-to-fingerprinting-ai-providers"
      title="The Complete Guide to Fingerprinting AI Providers"
      description="Everything we've learned building AIHackr — the signals, scoring, gotchas, and ethical guardrails behind reliable AI provider attribution."
      publishedTime="2026-04-18T00:00:00Z"
      displayDate="April 2026"
      category="Methodology"
      keywords="fingerprint AI provider, LLM detection methodology, AI attribution, AIHackr methodology"
      leads={[
        "This is the long-form companion to 'How to tell which LLM a website is using' — the field manual we wish we'd had when we started building AIHackr.",
      ]}
      sections={[
        {
          heading: "The signal hierarchy",
          bullets: [
            "Tier 1 (high confidence): provider-owned hostnames in network requests.",
            "Tier 2 (medium): SDK signatures and request/response schemas in JS bundles.",
            "Tier 3 (low): vendor mentions in HTML/JSON-LD, marketing copy, third-party crawls.",
            "We never collapse a Tier 3 hit into a high-confidence label.",
          ],
        },
        {
          heading: "Confidence scoring",
          bullets: [
            "Each signal carries a base score; multiple signals stack but with diminishing returns.",
            "We bucket scores into High (≥0.8), Medium (≥0.5), Low (≥0.6 floor for 'present'), None.",
            "Provider-added/removed transitions only fire when the signal crosses the floor.",
          ],
        },
        {
          heading: "Common false positives",
          bullets: [
            "Marketing pages mentioning 'powered by GPT' that route to a different provider in the product.",
            "Third-party scripts (analytics, CRMs) that themselves call OpenAI — not the host product.",
            "Stale CDN snapshots after a recent migration.",
          ],
        },
        {
          heading: "Ethical guardrails",
          bullets: [
            "Passive scanning only — we read what your homepage and product surface to anonymous users.",
            "We respect robots.txt and rate-limit aggressively.",
            "We surface evidence, not assertions — every detection links to the signals we used.",
          ],
        },
      ]}
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
          { title: "How to tell which LLM a website is using", slug: "how-to-tell-which-llm-a-website-is-using" },
          { title: "AI Gateways Explained", slug: "ai-gateways-explained-cloudflare-portkey-helicone" },
        ],
      }}
    />
  );
}
