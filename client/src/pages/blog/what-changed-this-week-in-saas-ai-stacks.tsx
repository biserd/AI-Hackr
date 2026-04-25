import { BlogPostScaffold } from "@/components/blog-post";

export default function Post() {
  return (
    <BlogPostScaffold
      slug="what-changed-this-week-in-saas-ai-stacks"
      title="What Changed This Week in SaaS AI Stacks"
      description="A weekly pulse on which SaaS products switched AI providers, added new model families, or quietly migrated to gateways."
      publishedTime="2026-04-17T00:00:00Z"
      displayDate="April 2026"
      category="Weekly Pulse"
      keywords="SaaS AI changes this week, AI provider migrations, weekly AI report, who changed AI provider"
      leads={[
        "Most coverage of LLM adoption is anecdotal. AIHackr scans tracked products on a 7-day cadence, so this column is data — not gossip — about which AI provider migrations actually happened over the last week.",
      ]}
      sections={[
        {
          heading: "How we surface changes",
          bullets: [
            "We compare each company's primary AI provider against last week's scan.",
            "We apply a 0.6 confidence floor so confidence drift alone doesn't show up as a 'change'.",
            "We require two consecutive scans before declaring a removal — single-scan flakes are filtered.",
          ],
        },
        {
          heading: "This week's headline movers",
          bullets: [
            "See the live 'changes this week' panel on the leaderboard for the current set.",
            "Each entry links to the full intelligence report with diff and evidence.",
          ],
        },
        {
          heading: "Why these moves matter",
          bullets: [
            "Provider switches are leading indicators of cost pressure or capability complaints.",
            "Watch for clusters — if 3+ companies in one category switch the same way, the trend is real.",
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
          { name: "Notion", slug: "notion" },
        ],
        posts: [
          { title: "The State of AI in SaaS — 2026", slug: "the-state-of-ai-in-saas-2026" },
          { title: "OpenAI vs Anthropic", slug: "openai-vs-anthropic-which-saas-companies-use-which" },
        ],
      }}
    />
  );
}
