import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { Cpu, Bot, ArrowLeft, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { SEO } from "@/components/seo";
import type { TrackedCompany, Scan, ProviderRollup } from "@shared/schema";

interface ProviderResponse {
  provider: ProviderRollup;
  companies: Array<TrackedCompany & { lastScan: Scan | null }>;
}

export default function ProviderRollupPage() {
  const params = useParams<{ slug: string }>();
  const { data, isLoading } = useQuery<ProviderResponse>({
    queryKey: [`/api/providers/${params.slug}`],
    enabled: Boolean(params.slug),
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const { provider, companies } = data;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`Companies using ${provider.name} — AIHackr`}
        description={`The full list of ${companies.length} SaaS products that AIHackr has detected running ${provider.name}. ${provider.description}`}
        url={`https://aihackr.com/provider/${provider.slug}`}
        keywords={`${provider.name} customers, who uses ${provider.name}, ${provider.name} SaaS, ${provider.name} adoption`}
      />
      <Nav />

      <main className="max-w-5xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link href="/leaderboard" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-6">
            <ArrowLeft className="w-3.5 h-3.5" />
            Leaderboard
          </Link>

          <div className="mb-8">
            <Badge variant="outline" className="mb-3 bg-primary/20 text-primary border-primary/30">
              <Bot className="w-3 h-3 mr-1" />
              Provider Rollup
            </Badge>
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-3" data-testid="text-provider-name">
              SaaS products running on {provider.name}
            </h1>
            <p className="text-muted-foreground text-lg max-w-3xl">{provider.description}</p>
            <p className="text-muted-foreground mt-2">
              {companies.length} companies detected — refreshed weekly. Click into any row to see the full evidence trail.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {companies.length === 0 ? (
              <Card className="md:col-span-2">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No companies detected on this provider yet. Check back after the next scan cycle.
                </CardContent>
              </Card>
            ) : (
              companies.map((c) => (
                <Link key={c.slug} href={`/stack/${c.slug}`}>
                  <Card className="cursor-pointer hover:border-primary/50 transition-colors group" data-testid={`card-provider-company-${c.slug}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg group-hover:text-primary transition-colors flex items-center gap-2">
                            {c.name}
                            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-0.5">{c.domain}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{c.category}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>

          <div className="mt-10 text-center">
            <Link href="/leaderboard" className="text-primary hover:underline text-sm">
              See the full leaderboard →
            </Link>
          </div>
        </motion.div>
      </main>

      <footer className="border-t border-border mt-12 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>
            <Link href="/leaderboard" className="hover:underline">AI Leaderboard</Link> · <Link href="/stack" className="hover:underline">Stack Index</Link> · <Link href="/blog" className="hover:underline">Blog</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

function Nav() {
  return (
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
  );
}
