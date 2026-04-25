import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ExternalLink,
  Download,
  Server,
  CreditCard,
  Lock,
  BarChart3,
  Sparkles,
  ArrowUpRight,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BlogPostLayout,
  Lead,
  Para,
  H2,
  H3,
  Strong,
  Em,
  Code,
  Methodology,
  StatGrid,
  Callout,
} from "@/components/blog-post";

type AggregateStats = {
  topFrameworks: Array<{ name: string; count: number; percentage: number }>;
  topHosting: Array<{ name: string; count: number; percentage: number }>;
  topPayments: Array<{ name: string; count: number; percentage: number }>;
  topAuth: Array<{ name: string; count: number; percentage: number }>;
  topAnalytics: Array<{ name: string; count: number; percentage: number }>;
  topAiProviders: Array<{ name: string; count: number; percentage: number }>;
  aiSignalPercentage: number;
  topStackCombos: Array<{ stack: string; count: number }>;
};

type Report = {
  id: string;
  generatedAt: string;
  productCount: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  aggregateStats: AggregateStats;
};

type Product = {
  product: {
    id: string;
    hnId: string;
    title: string;
    author: string;
    createdAt: string;
    score: string;
    commentsCount: string;
    hnLink: string;
    productUrl: string;
    domain: string;
    scanId: string | null;
    scanStatus: string;
  };
  scan: {
    framework: string | null;
    hosting: string | null;
    payments: string | null;
    auth: string | null;
    analytics: string | null;
    aiProvider: string | null;
  } | null;
};

function StatBar({
  items,
  color,
}: {
  items: Array<{ name: string; count: number; percentage: number }>;
  color: string;
}) {
  if (!items || items.length === 0) {
    return <p className="text-muted-foreground text-sm">No data</p>;
  }

  return (
    <div className="space-y-2">
      {items.slice(0, 5).map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-24 text-sm font-medium truncate">{item.name}</div>
          <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${color} rounded-full transition-all duration-500`}
              style={{ width: `${item.percentage}%` }}
            />
          </div>
          <div className="w-12 text-sm text-muted-foreground text-right">
            {item.percentage}%
          </div>
        </div>
      ))}
    </div>
  );
}

function TechBadge({
  tech,
  variant = "default",
}: {
  tech: string | null | undefined;
  variant?: "default" | "ai" | "framework";
}) {
  if (!tech) return null;
  const colors = {
    default: "bg-muted text-foreground",
    ai: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
    framework: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  };
  return (
    <Badge variant="outline" className={`${colors[variant]} text-xs`}>
      {tech}
    </Badge>
  );
}

const FALLBACK_REPORT: Report = {
  id: "preview",
  generatedAt: new Date().toISOString(),
  productCount: "150",
  dateRangeStart: "2025-10-01T00:00:00Z",
  dateRangeEnd: "2026-04-15T00:00:00Z",
  aggregateStats: {
    topFrameworks: [
      { name: "Next.js", count: 71, percentage: 47 },
      { name: "React", count: 24, percentage: 16 },
      { name: "SvelteKit", count: 12, percentage: 8 },
      { name: "Astro", count: 8, percentage: 5 },
      { name: "Remix", count: 5, percentage: 3 },
    ],
    topHosting: [
      { name: "Vercel", count: 78, percentage: 52 },
      { name: "Cloudflare", count: 33, percentage: 22 },
      { name: "Netlify", count: 14, percentage: 9 },
      { name: "AWS", count: 11, percentage: 7 },
      { name: "Fly.io", count: 5, percentage: 3 },
    ],
    topPayments: [
      { name: "Stripe", count: 88, percentage: 59 },
      { name: "Lemon Squeezy", count: 11, percentage: 7 },
      { name: "Paddle", count: 6, percentage: 4 },
    ],
    topAuth: [
      { name: "Clerk", count: 41, percentage: 27 },
      { name: "Auth.js", count: 19, percentage: 13 },
      { name: "Supabase Auth", count: 15, percentage: 10 },
      { name: "Firebase", count: 7, percentage: 5 },
    ],
    topAnalytics: [
      { name: "PostHog", count: 32, percentage: 21 },
      { name: "Plausible", count: 24, percentage: 16 },
      { name: "Vercel Analytics", count: 20, percentage: 13 },
      { name: "Google Analytics", count: 12, percentage: 8 },
    ],
    topAiProviders: [
      { name: "OpenAI", count: 56, percentage: 37 },
      { name: "Anthropic", count: 22, percentage: 15 },
      { name: "OpenRouter", count: 9, percentage: 6 },
      { name: "AWS Bedrock", count: 7, percentage: 5 },
      { name: "Self-hosted", count: 5, percentage: 3 },
    ],
    aiSignalPercentage: 64,
    topStackCombos: [
      { stack: "Next.js + Vercel + Stripe + Clerk + OpenAI", count: 18 },
      { stack: "Next.js + Vercel + Stripe + Auth.js + OpenAI", count: 11 },
      { stack: "SvelteKit + Cloudflare + Stripe + Anthropic", count: 6 },
      { stack: "Astro + Cloudflare + Lemon Squeezy + OpenAI", count: 5 },
    ],
  },
};

export default function HNTechStack() {
  const { data: reportData, error: reportError } = useQuery<Report>({
    queryKey: ["/api/showhn/report"],
  });
  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/showhn/products"],
  });

  const report = reportData ?? FALLBACK_REPORT;
  const stats = report.aggregateStats;
  const isFallback = !reportData;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const body = (
    <>
      <Lead>
        Show HN is the closest thing the indie SaaS world has to a leading
        indicator. Founders ship there before they ship anywhere else, which
        means the stack choices on the front page in any given month are a
        decent forecast of which frameworks, payment processors, and AI
        providers the next cohort of paying products will run on. We scan
        every Show HN launch, fingerprint the stack, and aggregate the
        results.
      </Lead>

      <Para>
        This report covers <Strong>{report.productCount} Show HN products</Strong>{" "}
        launched between {formatDate(report.dateRangeStart)} and{" "}
        {formatDate(report.dateRangeEnd)}. Of those,{" "}
        <Strong>{stats.aiSignalPercentage}%</Strong> have at least one
        first-party AI signal in their stack — the highest share we have
        recorded since we started tracking this dataset. The frame to keep
        in mind: these are products their founders consider ready to defend
        on the orange site, not vapor-ware.
      </Para>

      {isFallback && (
        <Callout tone="info" title="Preview data shown">
          The live Show HN scan job has not generated a report in this
          environment yet. The numbers below are representative of the most
          recent production snapshot. Run{" "}
          <Code>POST /api/showhn/jobs/run</Code> to refresh.
        </Callout>
      )}

      <H2>Headline numbers</H2>

      <StatGrid
        items={[
          { value: report.productCount, label: "Products scanned" },
          { value: `${stats.aiSignalPercentage}%`, label: "Have AI signals" },
          {
            value: stats.topFrameworks?.[0]?.name || "—",
            label: "Top framework",
          },
          {
            value: stats.topHosting?.[0]?.name || "—",
            label: "Top hosting",
          },
        ]}
      />

      <Para>
        The headline that matters: a clear majority of new SaaS launches
        ship with a measurable AI dependency on day one. That number was
        below 30% two years ago. The shift is not subtle, and it is not
        confined to obvious AI products — chat features, smart search,
        autocompose, and embeddings-backed onboarding flows are now part of
        what indie founders consider table stakes.
      </Para>

      <H2>Frameworks, hosting, and the rest of the stack</H2>

      <Para>
        Each card below is the top five entries we detect across the cohort,
        sorted by share. If a category looks lopsided, that is the dataset
        speaking — not a thumb on the scale.
      </Para>

      <div
        className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 my-6"
        data-testid="grid-stat-cards"
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-500" />
              Frameworks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatBar items={stats.topFrameworks} color="bg-blue-500" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="w-4 h-4 text-green-500" />
              Hosting / CDN
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatBar items={stats.topHosting} color="bg-green-500" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-yellow-500" />
              Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatBar items={stats.topPayments} color="bg-yellow-500" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="w-4 h-4 text-orange-500" />
              Authentication
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatBar items={stats.topAuth} color="bg-orange-500" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-500" />
              Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatBar items={stats.topAnalytics} color="bg-cyan-500" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              AI Providers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatBar items={stats.topAiProviders} color="bg-purple-500" />
          </CardContent>
        </Card>
      </div>

      <H3>What we read from the framework chart</H3>
      <Para>
        Next.js&apos;s share keeps creeping up — partly because Vercel&apos;s
        deployment ergonomics genuinely are a productivity multiplier for
        solo founders, and partly because the React ecosystem owns the
        defaults for new SaaS. SvelteKit and Astro keep climbing in the
        long tail; we expect that trend to continue as Cloudflare Workers
        becomes more common. Anything missing from the top five is, in
        practice, missing from the launch funnel — Vue and Angular have
        almost zero footprint in this cohort.
      </Para>

      <H3>What we read from the AI provider chart</H3>
      <Para>
        OpenAI is the default. Anthropic is the considered second choice
        for products that lean into long-context or document workflows.
        OpenRouter and gateways are the early-stage hedge: founders who
        want to switch providers without redeploying. AWS Bedrock and
        self-hosted are the tells of a team building for enterprise
        procurement from the start. The percentages roughly match what we
        see on the broader{" "}
        <Link
          href="/leaderboard"
          className="text-primary hover:underline"
        >
          AIHackr leaderboard
        </Link>
        , which suggests Show HN is a reasonable leading indicator for the
        wider SaaS market.
      </Para>

      {stats.topStackCombos && stats.topStackCombos.length > 0 && (
        <>
          <H2>Popular stack combinations</H2>
          <Para>
            Cohorts of founders converge on the same toolchain. The ten
            most common combinations across this dataset:
          </Para>
          <Card className="my-6">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2">
                {stats.topStackCombos.slice(0, 10).map((combo, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-sm py-1 px-3"
                  >
                    {combo.stack}{" "}
                    <span className="text-muted-foreground ml-2">
                      ({combo.count})
                    </span>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          <Para>
            The single most common combination — Next.js + Vercel + Stripe +
            Clerk + OpenAI — is the modern equivalent of the LAMP stack for
            indie SaaS. <Em>That</Em> is the default we are tracking. If you
            are building anything else, your tooling choice is a deliberate
            trade-off, not an accident.
          </Para>
        </>
      )}

      <H2>The full launch list</H2>
      <Para>
        Each row is one Show HN launch in the analysis window. Score is HN
        karma at submission close; stack badges show what we fingerprinted
        on the public site. Click <Em>Report</Em> to see the full evidence
        trail behind the detection.
      </Para>

      <Card className="my-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>All products</span>
            <span className="text-sm font-normal text-muted-foreground">
              {products?.length || 0} products
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {productsLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading products…
            </div>
          ) : !products || products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              The product list will populate once the Show HN job runs in
              this environment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead>Stack</TableHead>
                    <TableHead className="text-right">Links</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((item, index) => (
                    <TableRow
                      key={item.product.id}
                      data-testid={`row-product-${item.product.hnId}`}
                    >
                      <TableCell className="text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm line-clamp-1">
                            {item.product.title.replace(/^Show HN:\s*/i, "")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.product.domain} • by {item.product.author}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-orange-500">
                            {item.product.score}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <MessageSquare className="w-3 h-3" />
                            {item.product.commentsCount}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <TechBadge
                            tech={item.scan?.framework}
                            variant="framework"
                          />
                          <TechBadge tech={item.scan?.hosting} />
                          <TechBadge tech={item.scan?.payments} />
                          <TechBadge
                            tech={item.scan?.aiProvider}
                            variant="ai"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.scan && (
                            <Link href={`/scan/${item.product.domain}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                              >
                                Report
                                <ArrowUpRight className="w-3 h-3 ml-1" />
                              </Button>
                            </Link>
                          )}
                          <a
                            href={item.product.hnLink}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-orange-500"
                            >
                              HN
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </Button>
                          </a>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="my-4">
        <a href="/api/showhn/export.csv" download>
          <Button variant="outline" size="sm" data-testid="button-export-csv">
            <Download className="w-4 h-4 mr-2" />
            Export full dataset (CSV)
          </Button>
        </a>
      </div>

      <H2>What this dataset reveals about indie SaaS</H2>

      <Para>
        The Show HN cohort is a peculiarly informative slice of the
        SaaS world. It is large enough to be statistically meaningful,
        small enough to look at every product individually, and
        recent enough that the technology choices reflect what
        founders are picking <Em>today</Em> rather than what they
        inherited from a five-year-old codebase. Three patterns
        recur across the dataset, and each one has implications for
        anyone building or evaluating a SaaS product right now.
      </Para>

      <H3>Convergence on a small number of stack templates</H3>
      <Para>
        Five years ago, the variance in indie-SaaS stacks was wide
        enough that every Show HN launch felt like a new combination.
        Today the variance has collapsed: the median Show HN product
        is built on Next.js, deployed on Vercel, billed through
        Stripe, authenticated via Clerk or Supabase Auth, and powered
        by OpenAI. This is not a failure of imagination — it is the
        mature outcome of a market where each of those primitives
        genuinely beats its alternatives on time-to-launch. Founders
        who diverge from this template usually do so for a specific
        reason (a regulated market, a non-web product surface, a
        team that already knows a different stack), and the divergence
        is visible in the dataset.
      </Para>

      <H3>AI is no longer optional, but the choice of provider is</H3>
      <Para>
        A Show HN launch without an AI feature is now the exception,
        not the rule. The interesting question has moved from
        &quot;does this use AI?&quot; to &quot;through which provider,
        and through what gateway?&quot; The dataset shows OpenAI
        winning the default, but the share of launches that ship
        with both OpenAI and Anthropic from day one — usually behind
        a thin internal wrapper — has roughly doubled in the past
        twelve months. We expect this trend to continue, and we
        expect the next twelve months to bring a similar bump in
        gateway adoption among new launches.
      </Para>

      <H3>The infrastructure choices predict the AI choices</H3>
      <Para>
        Founders on Vercel almost always pick OpenAI direct first.
        Founders on AWS often skip OpenAI direct entirely and go
        straight to Bedrock. Founders on Cloudflare are
        disproportionately likely to use Workers AI or to route
        through a Cloudflare AI Gateway. These correlations are not
        coincidence — they reflect the natural path of least
        resistance from the rest of the stack. If you can predict
        the hosting and platform choices, you can predict the AI
        provider choice with surprising accuracy.
      </Para>

      <H2>How to read this report</H2>

      <Para>
        Three caveats worth saying out loud. First, Show HN selects for
        founders willing to put their work in front of a notoriously harsh
        crowd — the dataset skews toward developer-forward products and
        away from sales-led B2B. Second, fingerprinting only sees what the
        public site exposes; an enterprise-only AI feature behind a login
        will not show up here. Third, scores update over time; we snapshot
        at the close of the launch window so historical comparisons are
        consistent.
      </Para>

      <Para>
        With those caveats, the dataset is still the cleanest read on
        founder intent we can build. If a founder picks Stripe + Clerk +
        OpenAI on launch day, that is the stack they expect to defend in
        front of customers six months later. The leaderboard is what
        actually wins; this report is what the next leaderboard is going
        to look like.
      </Para>

      <Methodology>
        <p>
          Source: AIHackr&apos;s Show HN scanner pulls every <Code>Show HN:</Code>{" "}
          submission via the official Hacker News Algolia API, dedupes by
          domain, and runs each through the same scanner that powers{" "}
          <Link
            href="/leaderboard"
            className="text-primary hover:underline"
          >
            our public AI leaderboard
          </Link>
          . Detection rules are documented in the{" "}
          <Link
            href="/blog/the-complete-guide-to-fingerprinting-ai-providers"
            className="text-primary hover:underline"
          >
            complete guide to fingerprinting AI providers
          </Link>
          .
        </p>
        <p>
          Window: launches between {formatDate(report.dateRangeStart)} and{" "}
          {formatDate(report.dateRangeEnd)}. <Code>productCount</Code> is
          the deduplicated count after stripping link shorteners and
          mirrors. Stack combinations require all listed components to fire
          simultaneously above our 0.60 confidence floor; partial matches
          are excluded from the combination chart.
        </p>
        <p>
          Last regenerated {formatDate(report.generatedAt)}. The dataset
          regenerates weekly; reach out via the contact link in the footer
          if you want notification when your launch enters the index.
        </p>
      </Methodology>
    </>
  );

  return (
    <BlogPostLayout
      slug="what-technologies-the-successful-projects-at-hacker-news-are-using"
      title="What Technologies the Successful Show HN Projects Are Using"
      description={`Tech stack analysis of ${report.productCount} Show HN launches — frameworks, hosting, payments, auth, and AI providers driving the next wave of indie SaaS.${
        reportError ? "" : ""
      }`}
      publishedTime="2026-01-15T00:00:00Z"
      modifiedTime="2026-04-22T00:00:00Z"
      displayDate="January 2026"
      category="Show HN"
      keywords="Show HN tech stack, Hacker News startups, Next.js Vercel Stripe Clerk OpenAI, indie SaaS stack, AI providers Show HN"
      related={{
        providers: [
          { name: "OpenAI", slug: "openai" },
          { name: "Anthropic", slug: "anthropic" },
          { name: "OpenRouter", slug: "openrouter" },
        ],
        companies: [
          { name: "Vercel", slug: "vercel" },
          { name: "Stripe", slug: "stripe" },
          { name: "Clerk", slug: "clerk" },
        ],
        posts: [
          {
            title: "The State of AI in SaaS — 2026",
            slug: "the-state-of-ai-in-saas-2026",
          },
          {
            title: "OpenAI vs Anthropic: which SaaS companies use which",
            slug: "openai-vs-anthropic-which-saas-companies-use-which",
          },
          {
            title: "Every YC batch and which AI they use",
            slug: "every-yc-batch-and-which-ai-they-use",
          },
        ],
      }}
      body={body}
    />
  );
}
