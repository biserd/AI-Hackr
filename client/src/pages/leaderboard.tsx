import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Cpu,
  Trophy,
  TrendingUp,
  Filter,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Code2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ThemeToggle } from "@/components/theme-toggle";
import { SEO } from "@/components/seo";
import type { TrackedCompany, Scan, ProviderRollup } from "@shared/schema";

interface LeaderboardResponse {
  rows: Array<TrackedCompany & { lastScan: Scan | null }>;
  categories: string[];
  providers: ProviderRollup[];
}

interface ChangesResponse {
  rows: Array<TrackedCompany & { lastScan: Scan | null }>;
}

function confidenceColor(c: string | null | undefined): string {
  if (c === "High") return "text-secondary bg-secondary/20 border-secondary/30";
  if (c === "Medium") return "text-yellow-500 bg-yellow-500/20 border-yellow-500/30";
  if (c === "Low") return "text-orange-500 bg-orange-500/20 border-orange-500/30";
  return "text-muted-foreground bg-muted border-border";
}

export default function Leaderboard() {
  const [provider, setProvider] = useState("all");
  const [category, setCategory] = useState("all");
  const [confidence, setConfidence] = useState("all");
  const [changedOnly, setChangedOnly] = useState(false);

  const { data, isLoading } = useQuery<LeaderboardResponse>({
    queryKey: ["/api/leaderboard", provider, category, confidence, changedOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (provider !== "all") params.set("provider", provider);
      if (category !== "all") params.set("category", category);
      if (confidence !== "all") params.set("confidence", confidence);
      if (changedOnly) params.set("changedThisWeek", "true");
      const res = await fetch(`/api/leaderboard?${params.toString()}`);
      return res.json();
    },
  });

  const { data: changes } = useQuery<ChangesResponse>({
    queryKey: ["/api/leaderboard/changes-this-week"],
  });

  const total = data?.rows.length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="The AI Leaderboard — Which LLMs Power SaaS"
        description="Live ranking of which AI provider every major SaaS product uses. Filter by provider, category, confidence. Updated weekly with stack-change diffs."
        url="https://aihackr.com/leaderboard"
        keywords="AI leaderboard, LLM market share SaaS, OpenAI vs Anthropic SaaS, which AI does SaaS use"
      />
      <Nav />

      <main className="max-w-7xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-8">
            <Badge variant="outline" className="mb-3 bg-primary/20 text-primary border-primary/30">
              <Trophy className="w-3 h-3 mr-1" />
              Live AI Leaderboard
            </Badge>
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-3">
              Who's running which AI?
            </h1>
            <p className="text-muted-foreground text-lg max-w-3xl">
              A continuously updated ranking of {total} SaaS products by their primary AI provider, with confidence levels and weekly change diffs.
            </p>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-5">
              <div className="flex flex-wrap gap-3 items-center">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger className="w-[180px]" data-testid="select-filter-provider">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All providers</SelectItem>
                    {data?.providers.map((p) => (
                      <SelectItem key={p.slug} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-[180px]" data-testid="select-filter-category">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {data?.categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={confidence} onValueChange={setConfidence}>
                  <SelectTrigger className="w-[160px]" data-testid="select-filter-confidence">
                    <SelectValue placeholder="Confidence" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any confidence</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant={changedOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChangedOnly((v) => !v)}
                  data-testid="button-toggle-changed-week"
                >
                  <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                  {changedOnly ? "Showing only changed this week" : "Changed this week only"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Changes-this-week panel */}
          {changes?.rows && changes.rows.length > 0 && (
            <Card className="mb-6 border-primary/30 bg-gradient-to-r from-primary/5 to-secondary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  This Week's Provider Changes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {changes.rows.map((r) => (
                    <Link key={r.slug} href={`/stack/${r.slug}`}>
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-primary/10 transition-colors"
                        data-testid={`badge-change-${r.slug}`}
                      >
                        {r.name} → {r.lastScan?.aiProvider || "Unknown"}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {isLoading ? (
                <div className="text-center text-muted-foreground py-16">Loading…</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">#</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Primary AI</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>AI Framework</TableHead>
                      <TableHead>Inference Host</TableHead>
                      <TableHead>Secondary</TableHead>
                      <TableHead>Last Scan</TableHead>
                      <TableHead>W-o-W</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.rows.map((r, idx) => {
                      const changedRecent =
                        r.providerChangedAt &&
                        new Date(r.providerChangedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000;
                      return (
                        <TableRow key={r.slug} data-testid={`row-leaderboard-${r.slug}`}>
                          <TableCell className="font-mono text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <Link href={`/stack/${r.slug}`} className="font-medium hover:text-primary transition-colors">
                              {r.name}
                            </Link>
                            <div className="text-xs text-muted-foreground">{r.category}</div>
                          </TableCell>
                          <TableCell className="font-medium">{r.lastScan?.aiProvider || "—"}</TableCell>
                          <TableCell>
                            {r.lastScan?.aiConfidence ? (
                              <Badge variant="outline" className={`text-xs ${confidenceColor(r.lastScan.aiConfidence)}`}>
                                {r.lastScan.aiConfidence}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.lastScan?.framework || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.lastScan?.hosting || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.lastScan?.aiGateway || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.lastScannedAt ? new Date(r.lastScannedAt).toLocaleDateString() : "Pending"}
                          </TableCell>
                          <TableCell>
                            {changedRecent ? (
                              <ArrowUpRight className="w-4 h-4 text-primary" />
                            ) : (
                              <Minus className="w-4 h-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Link href={`/stack/${r.slug}`}>
                              <Button variant="ghost" size="sm" data-testid={`button-view-${r.slug}`}>
                                <ArrowRight className="w-4 h-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Provider rollups */}
          {data?.providers && data.providers.length > 0 && (
            <div className="mt-12">
              <h2 className="font-display text-2xl font-bold mb-4">Browse by provider</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {data.providers.map((p) => (
                  <Link key={p.slug} href={`/provider/${p.slug}`}>
                    <Card className="cursor-pointer hover:border-primary/50 transition-colors" data-testid={`card-provider-${p.slug}`}>
                      <CardContent className="pt-4 pb-4">
                        <div className="font-display font-semibold flex items-center gap-2">
                          <Code2 className="w-4 h-4 text-primary" />
                          {p.name}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <Card className="mt-10 border-primary/30 bg-primary/5">
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <div className="font-display font-semibold">Embed the leaderboard</div>
                <p className="text-sm text-muted-foreground">Drop the live ranking into your blog or pitch deck.</p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(`<iframe src="https://aihackr.com/embed/leaderboard" width="100%" height="600" frameborder="0"></iframe>`);
                }}
                data-testid="button-copy-embed-leaderboard"
              >
                Copy embed code
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <footer className="border-t border-border mt-12 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>
            <Link href="/" className="text-primary hover:underline">AIHackr</Link> — AI provider intelligence for SaaS · <Link href="/stack" className="hover:underline">Index</Link> · <Link href="/blog" className="hover:underline">Blog</Link>
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
          <Link href="/stack" className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline">Index</Link>
          <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline">Blog</Link>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
