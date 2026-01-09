import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { 
  Cpu, 
  ExternalLink, 
  Download, 
  TrendingUp,
  Server,
  CreditCard,
  Lock,
  BarChart3,
  Sparkles,
  ArrowUpRight,
  MessageSquare
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
import { ThemeToggle } from "@/components/theme-toggle";

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

function StatBar({ items, color }: { items: Array<{ name: string; count: number; percentage: number }>; color: string }) {
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
          <div className="w-12 text-sm text-muted-foreground text-right">{item.percentage}%</div>
        </div>
      ))}
    </div>
  );
}

function TechBadge({ tech, variant = "default" }: { tech: string | null; variant?: "default" | "ai" | "framework" }) {
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

export default function ShowHNReport() {
  const { data: report, isLoading: reportLoading, error: reportError } = useQuery<Report>({
    queryKey: ["/api/showhn/report"],
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/showhn/products"],
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (reportLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading report...</div>
      </div>
    );
  }

  if (reportError || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-bold mb-2">No Report Available</h2>
            <p className="text-muted-foreground mb-4">
              The Show HN Stack Report hasn't been generated yet. 
              Run the job script to fetch and scan Show HN products.
            </p>
            <Link href="/">
              <Button>Back to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = report.aggregateStats;

  return (
    <div className="min-h-screen bg-background">
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
            <a href="/api/showhn/export.csv" download>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 bg-orange-500/20 text-orange-400 border-orange-500/30">
              <TrendingUp className="w-3 h-3 mr-1" />
              Show HN Analysis
            </Badge>
            <h1 className="font-display text-4xl font-bold mb-4">
              What Top Show HN Launches Use
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Tech stack analysis of {report.productCount} Show HN products from{" "}
              {formatDate(report.dateRangeStart)} to {formatDate(report.dateRangeEnd)}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-primary">{report.productCount}</div>
                <div className="text-sm text-muted-foreground">Products Scanned</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-purple-500">{stats.aiSignalPercentage}%</div>
                <div className="text-sm text-muted-foreground">With AI Signals</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-blue-500">{stats.topFrameworks?.[0]?.name || "—"}</div>
                <div className="text-sm text-muted-foreground">Top Framework</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-green-500">{stats.topHosting?.[0]?.name || "—"}</div>
                <div className="text-sm text-muted-foreground">Top Hosting</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
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

          {stats.topStackCombos && stats.topStackCombos.length > 0 && (
            <Card className="mb-12">
              <CardHeader>
                <CardTitle className="text-base">Popular Stack Combinations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {stats.topStackCombos.slice(0, 10).map((combo, i) => (
                    <Badge key={i} variant="outline" className="text-sm py-1 px-3">
                      {combo.stack} <span className="text-muted-foreground ml-2">({combo.count})</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>All Products</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {products?.length || 0} products
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading products...</div>
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
                      {products?.map((item, index) => (
                        <TableRow key={item.product.id} data-testid={`row-product-${item.product.hnId}`}>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
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
                              <span className="font-bold text-orange-500">{item.product.score}</span>
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                <MessageSquare className="w-3 h-3" />
                                {item.product.commentsCount}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              <TechBadge tech={item.scan?.framework} variant="framework" />
                              <TechBadge tech={item.scan?.hosting} />
                              <TechBadge tech={item.scan?.payments} />
                              <TechBadge tech={item.scan?.aiProvider} variant="ai" />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {item.scan && (
                                <Link href={`/scan/${item.product.domain}`}>
                                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                                    Report
                                    <ArrowUpRight className="w-3 h-3 ml-1" />
                                  </Button>
                                </Link>
                              )}
                              <a href={item.product.hnLink} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-orange-500">
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
        </motion.div>
      </main>

      <footer className="border-t border-border mt-20 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>
            Generated by <Link href="/" className="text-primary hover:underline">AIHackr</Link> •{" "}
            Last updated {formatDate(report.generatedAt)}
          </p>
        </div>
      </footer>
    </div>
  );
}
