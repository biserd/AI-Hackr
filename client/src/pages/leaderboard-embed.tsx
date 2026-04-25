import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { TrackedCompany, Scan, ProviderRollup } from "@shared/schema";

interface LeaderboardResponse {
  rows: Array<TrackedCompany & { lastScan: Scan | null }>;
  categories: string[];
  providers: ProviderRollup[];
}

function confidenceColor(c: string | null | undefined): string {
  if (c === "High") return "text-secondary bg-secondary/20 border-secondary/30";
  if (c === "Medium") return "text-yellow-500 bg-yellow-500/20 border-yellow-500/30";
  if (c === "Low") return "text-orange-500 bg-orange-500/20 border-orange-500/30";
  return "text-muted-foreground bg-muted border-border";
}

/**
 * Minimal embed-friendly leaderboard. Renders no nav, no footer, no SEO tags
 * — just the ranking table sized to fit inside an iframe.
 *
 * Query params:
 *   ?provider=OpenAI       — filter rows whose primary AI matches (substring, case-insensitive)
 *   ?category=Productivity — filter by category
 *   ?limit=10              — cap how many rows render (default 50, max 100)
 *   ?theme=light|dark      — force a theme (default: inherit from <html>)
 *   ?filter=changed        — only show rows that changed primary provider in the last 7d
 */
export default function LeaderboardEmbed() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const providerFilter = params.get("provider") || "";
  const categoryFilter = params.get("category") || "";
  // Parse `limit` defensively: invalid input (e.g. ?limit=abc) must fall
  // back to the default 50 rather than rendering 0 rows. parseInt returns
  // NaN for bad input which Math.min/Math.max happily propagate, so we
  // explicitly check Number.isFinite before clamping.
  const limitParam = parseInt(params.get("limit") || "", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(100, Math.max(1, limitParam)) : 50;
  const theme = params.get("theme") || "";
  const filter = params.get("filter") || "";

  // Force a theme on the embed root so it visually matches the host page.
  useEffect(() => {
    if (theme === "light" || theme === "dark") {
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.classList.toggle("light", theme === "light");
    }
  }, [theme]);

  const { data, isLoading } = useQuery<LeaderboardResponse>({
    queryKey: ["/api/leaderboard", providerFilter, categoryFilter, filter],
    queryFn: async () => {
      const qp = new URLSearchParams();
      if (providerFilter) qp.set("provider", providerFilter);
      if (categoryFilter) qp.set("category", categoryFilter);
      if (filter === "changed") qp.set("changedThisWeek", "true");
      const res = await fetch(`/api/leaderboard?${qp.toString()}`);
      return res.json();
    },
  });

  const visibleRows = (data?.rows ?? []).slice(0, limit);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold" data-testid="text-embed-title">
            AI Leaderboard{providerFilter ? ` — ${providerFilter}` : " — Live"}
          </h2>
          {(categoryFilter || filter) && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {categoryFilter && <>Category: {categoryFilter}</>}
              {categoryFilter && filter && " · "}
              {filter === "changed" && <>Changed this week only</>}
            </p>
          )}
        </div>
        <a
          href="https://aihackr.com/leaderboard"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
          data-testid="link-embed-attribution"
        >
          aihackr.com →
        </a>
      </div>
      {isLoading || !data ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>AI</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Last Scan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((r, idx) => (
                <TableRow key={r.slug} data-testid={`row-embed-${r.slug}`}>
                  <TableCell className="font-mono text-muted-foreground text-xs">{idx + 1}</TableCell>
                  <TableCell>
                    <a
                      href={`https://aihackr.com/stack/${r.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:text-primary"
                    >
                      {r.name}
                    </a>
                  </TableCell>
                  <TableCell>{r.lastScan?.aiProvider || "—"}</TableCell>
                  <TableCell>
                    {r.lastScan?.aiConfidence ? (
                      <Badge variant="outline" className={`text-xs ${confidenceColor(r.lastScan.aiConfidence)}`}>
                        {r.lastScan.aiConfidence}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.lastScannedAt ? new Date(r.lastScannedAt).toLocaleDateString() : "Pending"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground text-center mt-3">
        Powered by{" "}
        <a href="https://aihackr.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          AIHackr — AI provider intelligence for SaaS
        </a>
      </p>
    </div>
  );
}
