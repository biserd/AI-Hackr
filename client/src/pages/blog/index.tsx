import { Link } from "wouter";
import { motion } from "framer-motion";
import { Cpu, ArrowRight, TrendingUp, Calendar, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { SEO } from "@/components/seo";

const blogPosts = [
  {
    slug: "the-state-of-ai-in-saas-2026",
    title: "The State of AI in SaaS — 2026",
    description: "Our annual report on which AI providers, model families, and gateways power the modern SaaS stack.",
    date: "April 2026",
    category: "Annual Report",
    featured: true,
  },
  {
    slug: "what-changed-this-week-in-saas-ai-stacks",
    title: "What Changed This Week in SaaS AI Stacks",
    description: "A weekly pulse on which SaaS products switched AI providers, added new model families, or quietly migrated to gateways.",
    date: "April 2026",
    category: "Weekly Pulse",
    featured: true,
  },
  {
    slug: "openai-vs-anthropic-which-saas-companies-use-which",
    title: "OpenAI vs Anthropic: Which SaaS Companies Use Which",
    description: "Side-by-side breakdown of which SaaS products run GPT versus Claude — based on live AIHackr fingerprinting.",
    date: "April 2026",
    category: "Market Analysis",
    featured: false,
  },
  {
    slug: "claude-vs-gpt-4-real-world-saas-deployments",
    title: "Claude vs GPT-4: Real-World SaaS Deployments",
    description: "Comparing Claude 3.5/4 and GPT-4/4o adoption across actual production SaaS — not benchmarks.",
    date: "April 2026",
    category: "Comparison",
    featured: false,
  },
  {
    slug: "azure-openai-adoption-in-enterprise-saas",
    title: "Azure OpenAI Adoption in Enterprise SaaS",
    description: "Why regulated and enterprise-tier SaaS overwhelmingly choose Azure OpenAI over OpenAI direct.",
    date: "April 2026",
    category: "Enterprise",
    featured: false,
  },
  {
    slug: "aws-bedrock-customers-the-complete-list",
    title: "AWS Bedrock Customers: The Complete List",
    description: "Every SaaS product running Anthropic, Llama, or Titan models through AWS Bedrock — refreshed weekly.",
    date: "April 2026",
    category: "Provider Spotlight",
    featured: false,
  },
  {
    slug: "ai-gateways-explained-cloudflare-portkey-helicone",
    title: "AI Gateways Explained: Cloudflare AI Gateway, Portkey, Helicone",
    description: "What an AI gateway does, why ~1 in 5 SaaS now use one, and how AIHackr sees through them.",
    date: "April 2026",
    category: "Infrastructure",
    featured: false,
  },
  {
    slug: "self-hosted-llms-which-saas-products-run-their-own-models",
    title: "Self-Hosted LLMs: Which SaaS Products Run Their Own Models",
    description: "SaaS products quietly running open-weight Llama, Mistral, and fine-tuned derivatives in production.",
    date: "April 2026",
    category: "Infrastructure",
    featured: false,
  },
  {
    slug: "every-yc-batch-and-which-ai-they-use",
    title: "Every YC Batch and Which AI They Use",
    description: "Cohort-by-cohort breakdown of AI provider choices across recent Y Combinator batches.",
    date: "April 2026",
    category: "YC Watch",
    featured: false,
  },
  {
    slug: "how-to-tell-which-llm-a-website-is-using",
    title: "How to Tell Which LLM a Website Is Using",
    description: "A practical, evidence-based guide to fingerprinting any website's AI provider.",
    date: "April 2026",
    category: "How-to",
    featured: false,
  },
  {
    slug: "the-complete-guide-to-fingerprinting-ai-providers",
    title: "The Complete Guide to Fingerprinting AI Providers",
    description: "Everything we've learned building AIHackr — signals, scoring, gotchas, and ethical guardrails.",
    date: "April 2026",
    category: "Methodology",
    featured: false,
  },
  {
    slug: "what-technologies-the-successful-projects-at-hacker-news-are-using",
    title: "What Technologies the Successful Projects at Hacker News Are Using",
    description: "Deep analysis of tech stacks from top Show HN launches — frameworks, hosting, payments, auth, AI.",
    date: "January 2026",
    category: "Research",
    featured: false,
  },
];

export default function BlogIndex() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Blog - Tech Stack Insights & Research"
        description="Deep dives into AI provider trends, gateway adoption, and what's powering the modern SaaS stack. Continuously updated by AIHackr."
        url="https://aihackr.com/blog"
        keywords="AI provider trends, SaaS LLM analysis, OpenAI vs Anthropic, AI gateway research, AIHackr blog"
      />
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-primary" />
              </div>
              <span className="font-display font-semibold text-lg">AIHackr</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/leaderboard" className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline">Leaderboard</Link>
            <Link href="/stack" className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline">Index</Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-12">
            <Badge variant="outline" className="mb-4 bg-primary/20 text-primary border-primary/30">
              <BookOpen className="w-3 h-3 mr-1" />
              Blog
            </Badge>
            <h1 className="font-display text-4xl font-bold mb-4">
              AI Provider Intelligence — Research
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Data-grounded analysis of AI providers, gateways, and models powering SaaS — written from continuous wire-level fingerprinting.
            </p>
          </div>

          <div className="space-y-6">
            {blogPosts.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`}>
                <Card className="cursor-pointer hover:border-primary/50 transition-colors group" data-testid={`blog-post-${post.slug}`}>
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      {post.featured && (
                        <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Featured
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {post.category}
                      </Badge>
                    </div>
                    <CardTitle className="text-xl group-hover:text-primary transition-colors flex items-center gap-2">
                      {post.title}
                      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </CardTitle>
                    <CardDescription className="text-base">
                      {post.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4 mr-1" />
                      {post.date}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="mt-16 text-center">
            <p className="text-muted-foreground mb-4">
              Want the data behind these posts?
            </p>
            <Link href="/leaderboard">
              <Button variant="outline">
                See the live AI Leaderboard <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </main>

      <footer className="border-t border-border mt-20 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>
            <Link href="/" className="text-primary hover:underline">AIHackr</Link> — AI provider intelligence for SaaS
          </p>
        </div>
      </footer>
    </div>
  );
}
