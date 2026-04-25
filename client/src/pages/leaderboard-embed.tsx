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
 * — just the ranking table sized to fit inside an iframe. A small AIHackr
 * attribution lives at the bottom so embeds always link back.
 */
export default function LeaderboardEmbed() {
  const { data, isLoading } = useQuery<LeaderboardResponse>({
    queryKey: ["/api/leaderboard"],
  });

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">AI Leaderboard — Live</h2>
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
              {data.rows.slice(0, 50).map((r, idx) => (
                <TableRow key={r.slug}>
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
