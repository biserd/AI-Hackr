import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Cpu, Calendar, ArrowLeft, Trophy, ArrowRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SEO } from "@/components/seo";

interface SnapshotRow {
  rank: number;
  slug: string;
  name: string;
  domain: string;
  category: string;
  ycBatch: string | null;
  provider: string | null;
  confidence: string | null;
  gateway: string | null;
  framework: string | null;
  hosting: string | null;
  lastScannedAt: string | null;
}

interface SnapshotResponse {
  snapshot: {
    isoWeek: string;
    takenAt: string;
    totalCompanies: number;
    topProvider: string | null;
    changesCount: number;
    payload: {
      capturedAt: string;
      providerDistribution: Record<string, number>;
      rows: SnapshotRow[];
    };
  };
}

function confidenceColor(c: string | null | undefined): string {
  if (c === "High") return "text-secondary bg-secondary/20 border-secondary/30";
  if (c === "Medium") return "text-yellow-500 bg-yellow-500/20 border-yellow-500/30";
  if (c === "Low") return "text-orange-500 bg-orange-500/20 border-orange-500/30";
  return "text-muted-foreground bg-muted border-border";
}

export default function LeaderboardWeek() {
  const { week } = useParams<{ week: string }>();
  const { data, isLoading, isError } = useQuery<SnapshotResponse>({
    queryKey: [`/api/leaderboard/${week}`],
  });

  const ogUrl = `https://aihackr.com/leaderboard/${week}/og.png`;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading snapshot…
      </div>
    );
  }

  if (isError || !data?.snapshot) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <SEO
          title={`Leaderboard ${week} not found`}
          description="No archived snapshot exists for this ISO week yet."
          url={`https://aihackr.com/leaderboard/${week}`}
        />
        <h1 className="font-display text-3xl font-bold mb-2">Snapshot not available</h1>
        <p className="text-muted-foreground mb-6">No archived leaderboard exists for {week} yet — snapshots are written weekly.</p>
        <Link href="/leaderboard">
          <Button variant="outline" data-testid="button-back-leaderboard">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to live leaderboard
          </Button>
        </Link>
      </div>
    );
  }

  const snap = data.snapshot;
  const distribution = Object.entries(snap.payload.providerDistribution || {}).slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`AI Leaderboard — ${snap.isoWeek}`}
        description={`Archived ranking from ${snap.isoWeek}: ${snap.totalCompanies} SaaS products with ${snap.changesCount} provider changes. Top provider: ${snap.topProvider || "—"}.`}
        url={`https://aihackr.com/leaderboard/${snap.isoWeek}`}
        keywords="AI leaderboard archive, weekly SaaS AI snapshot, LLM market share history"
        image={ogUrl}
      />
      <Nav />

      <main className="max-w-7xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-2 text-sm text-muted-foreground flex items-center gap-2">
            <Link href="/leaderboard" className="hover:text-primary">Leaderboard</Link>
            <span>·</span>
            <span>Archive</span>
          </div>
          <Badge variant="outline" className="mb-3 bg-primary/20 text-primary border-primary/30">
            <Calendar className="w-3 h-3 mr-1" /> ISO {snap.isoWeek}
          </Badge>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-3" data-testid="text-snapshot-title">
            AI Leaderboard — {snap.isoWeek}
          </h1>
          <p className="text-muted-foreground text-lg max-w-3xl">
            Archived ranking captured {new Date(snap.takenAt).toLocaleString()}. {snap.totalCompanies} SaaS products tracked, {snap.changesCount} provider changes that week.
          </p>

          {/* Headline stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 mb-8">
            <Card>
              <CardContent className="pt-5">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Top provider</div>
                <div className="font-display text-2xl font-bold flex items-center gap-2 mt-1" data-testid="text-snapshot-top-provider">
                  <Trophy className="w-5 h-5 text-primary" />
                  {snap.topProvider || "—"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Companies ranked</div>
                <div className="font-display text-2xl font-bold mt-1">{snap.totalCompanies}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Provider changes</div>
                <div className="font-display text-2xl font-bold mt-1 text-secondary">{snap.changesCount}</div>
              </CardContent>
            </Card>
          </div>

          {distribution.length > 0 && (
            <Card className="mb-8">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Provider distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {distribution.map(([name, count]) => (
                    <Badge key={name} variant="outline" className="text-xs" data-testid={`badge-distribution-${name}`}>
                      {name}: {count}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Primary AI</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Gateway</TableHead>
                    <TableHead>Framework</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snap.payload.rows.map((r) => (
                    <TableRow key={r.slug} data-testid={`row-snapshot-${r.slug}`}>
                      <TableCell className="font-mono text-muted-foreground">{r.rank}</TableCell>
                      <TableCell>
                        <Link href={`/stack/${r.slug}`} className="font-medium hover:text-primary">
                          {r.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{r.category}</div>
                      </TableCell>
                      <TableCell>{r.provider || "—"}</TableCell>
                      <TableCell>
                        {r.confidence ? (
                          <Badge variant="outline" className={`text-xs ${confidenceColor(r.confidence)}`}>
                            {r.confidence}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.gateway || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.framework || "—"}</TableCell>
                      <TableCell>
                        <Link href={`/stack/${r.slug}`}>
                          <Button variant="ghost" size="sm">
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="mt-8 text-center">
            <Link href="/leaderboard">
              <Button variant="outline" data-testid="button-view-live">
                See the live leaderboard <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </main>
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
          <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline">Blog</Link>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
