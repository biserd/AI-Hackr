import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Cpu,
  Search,
  Filter,
  ArrowRight,
  Plus,
  Bot,
  Layers,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { SEO } from "@/components/seo";
import { toast } from "sonner";
import type { TrackedCompany, Scan, ProviderRollup } from "@shared/schema";

interface StackResponse {
  companies: TrackedCompany[];
  categories: string[];
}

interface LeaderboardForFilter {
  rows: Array<TrackedCompany & { lastScan: Scan | null }>;
  providers: ProviderRollup[];
}

function confidenceBadgeClass(c?: string | null): string {
  if (c === "High") return "text-secondary bg-secondary/20 border-secondary/30";
  if (c === "Medium") return "text-yellow-500 bg-yellow-500/20 border-yellow-500/30";
  if (c === "Low") return "text-orange-500 bg-orange-500/20 border-orange-500/30";
  return "text-muted-foreground bg-muted border-border";
}

export default function StackIndex() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [provider, setProvider] = useState<string>("all");
  const [requestOpen, setRequestOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<StackResponse>({
    queryKey: ["/api/stack", category, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category && category !== "all") params.set("category", category);
      if (search) params.set("search", search);
      const res = await fetch(`/api/stack?${params.toString()}`);
      return res.json();
    },
  });

  // Pull leaderboard rows so each card can show the detected provider +
  // confidence + last-scanned date inline (the /api/stack endpoint returns
  // the company row only — the joined scan lives on the leaderboard payload).
  const { data: lb } = useQuery<LeaderboardForFilter>({
    queryKey: ["/api/leaderboard"],
    queryFn: async () => {
      const res = await fetch("/api/leaderboard");
      return res.json();
    },
  });

  const scanBySlug = new Map(
    (lb?.rows ?? []).map((r) => [
      r.slug,
      { provider: r.lastScan?.aiProvider ?? null, confidence: r.lastScan?.aiConfidence ?? null, lastScannedAt: r.lastScannedAt },
    ]),
  );

  const filteredCompanies = (data?.companies ?? []).filter((c) => {
    if (provider === "all") return true;
    const target = provider.toLowerCase();
    const detected = (scanBySlug.get(c.slug)?.provider ?? "").toLowerCase();
    if (provider === "unknown") return !detected || detected === "none";
    return detected.includes(target);
  });

  const requestMutation = useMutation({
    mutationFn: async (input: { name: string; domain: string; category: string }) => {
      const res = await fetch("/api/stack/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.alreadyExists) {
        toast.success(`${data.company.name} is already on AIHackr — view its page`);
      } else {
        toast.success("Thanks — we've queued the request and will scan it soon");
      }
      setRequestOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/stack"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="The AI Stack of 50 Top SaaS Companies"
        description="See which AI provider, model family, and gateway power 50+ leading SaaS products. Updated weekly with confidence levels and evidence trail."
        url="https://aihackr.com/stack"
        keywords="SaaS AI stack, what AI does notion use, what LLM does intercom use, OpenAI customers, Anthropic customers, AI provider directory"
      />
      <Nav />

      <main className="max-w-6xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-10">
            <Badge variant="outline" className="mb-4 bg-primary/20 text-primary border-primary/30">
              <Layers className="w-3 h-3 mr-1" />
              The Stack Index
            </Badge>
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
              Which AI does every SaaS run?
            </h1>
            <p className="text-muted-foreground text-lg max-w-3xl">
              We continuously fingerprint the AI provider, model family and gateway behind {data?.companies.length ?? "50+"} of the best-known SaaS products.
              Search the index, then jump to a full intelligence report for any company.
            </p>
          </div>

          <Card className="mb-8 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search Notion, Stripe, Linear..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-stack-search"
                  />
                </div>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="md:w-[200px]" data-testid="select-stack-category">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {data?.categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger className="md:w-[200px]" data-testid="select-stack-provider">
                    <Bot className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="All providers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All providers</SelectItem>
                    {(lb?.providers ?? []).map((p) => (
                      <SelectItem key={p.slug} value={p.name}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-request-company">
                      <Plus className="w-4 h-4 mr-2" />
                      Request a company
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add a company to the AIHackr index</DialogTitle>
                      <DialogDescription>
                        Tell us a SaaS product you'd like fingerprinted. We'll queue it and scan it within a week.
                      </DialogDescription>
                    </DialogHeader>
                    <RequestForm onSubmit={(v) => requestMutation.mutate(v)} loading={requestMutation.isPending} />
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="text-center text-muted-foreground py-20">Loading the index…</div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground mb-3" data-testid="text-stack-count">
                Showing {filteredCompanies.length} {filteredCompanies.length === 1 ? "company" : "companies"}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCompanies.map((c) => {
                  const det = scanBySlug.get(c.slug);
                  const initials = c.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
                  return (
                    <Link key={c.slug} href={`/stack/${c.slug}`}>
                      <Card
                        className="cursor-pointer hover:border-primary/50 transition-colors group h-full"
                        data-testid={`card-company-${c.slug}`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start gap-3">
                            {c.logoUrl ? (
                              <img
                                src={c.logoUrl}
                                alt=""
                                className="w-10 h-10 rounded-lg object-cover bg-muted flex-shrink-0"
                                data-testid={`img-logo-${c.slug}`}
                              />
                            ) : (
                              <div
                                className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center text-xs font-display font-bold text-primary flex-shrink-0"
                                data-testid={`img-logo-${c.slug}`}
                              >
                                {initials}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <CardTitle className="text-base group-hover:text-primary transition-colors flex items-center gap-1.5 truncate" data-testid={`text-name-${c.slug}`}>
                                {c.name}
                                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                              </CardTitle>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.domain}</p>
                            </div>
                            <Badge variant="outline" className="text-[10px] flex-shrink-0">
                              {c.category}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[2.5em]">{c.description}</p>
                          <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/50">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Bot className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                              <span className="text-xs font-medium truncate" data-testid={`text-provider-${c.slug}`}>
                                {det?.provider || "Pending"}
                              </span>
                            </div>
                            {det?.confidence && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] flex-shrink-0 ${confidenceBadgeClass(det.confidence)}`}
                                data-testid={`badge-confidence-${c.slug}`}
                              >
                                {det.confidence}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-2">
                            {det?.lastScannedAt ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-secondary flex-shrink-0" />
                                <span>Scanned {new Date(det.lastScannedAt).toLocaleDateString()}</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3 text-primary flex-shrink-0" />
                                <span>Awaiting first scan</span>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-16 text-center">
            <p className="text-muted-foreground mb-4">
              Want a ranked view? Hop to the leaderboard.
            </p>
            <Link href="/leaderboard">
              <Button variant="outline" data-testid="button-go-leaderboard">
                See the AI Leaderboard <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}

function RequestForm({
  onSubmit,
  loading,
}: {
  onSubmit: (v: { name: string; domain: string; category: string }) => void;
  loading: boolean;
}) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [category, setCategory] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name || !domain || !category) return;
        onSubmit({ name, domain, category });
      }}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="r-name">Company name</Label>
        <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Notion" data-testid="input-request-name" />
      </div>
      <div>
        <Label htmlFor="r-domain">Domain</Label>
        <Input id="r-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="notion.so" data-testid="input-request-domain" />
      </div>
      <div>
        <Label htmlFor="r-cat">Category</Label>
        <Input id="r-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Productivity" data-testid="input-request-category" />
      </div>
      <Button type="submit" disabled={loading} className="w-full" data-testid="button-submit-request">
        {loading ? "Submitting…" : "Submit request"}
      </Button>
    </form>
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
          <Link href="/leaderboard" className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline">
            Leaderboard
          </Link>
          <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline">
            Blog
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border mt-20 py-8">
      <div className="max-w-7xl mx-auto px-6 text-center text-sm text-muted-foreground">
        <p>
          <Link href="/" className="text-primary hover:underline">AIHackr</Link> — AI provider intelligence for SaaS · <Link href="/leaderboard" className="hover:underline">Leaderboard</Link> · <Link href="/stack" className="hover:underline">Index</Link> · <Link href="/blog" className="hover:underline">Blog</Link>
        </p>
      </div>
    </footer>
  );
}
