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
    slug: "what-technologies-the-successful-projects-at-hacker-news-are-using",
    title: "What Technologies the Successful Projects at Hacker News Are Using",
    description: "Deep analysis of tech stacks from top Show HN launches - frameworks, hosting, payments, auth, and AI providers.",
    date: "January 2026",
    category: "Research",
    featured: true,
  },
];

export default function BlogIndex() {
  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Blog - Tech Stack Insights & Research"
        description="Deep dives into tech stack trends, AI adoption patterns, and what's powering successful SaaS products. Analysis from AIHackr."
        url="https://aihackr.com/blog"
        keywords="tech stack, AI providers, SaaS tools, framework analysis, hosting trends"
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
              Insights & Research
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Deep dives into tech stack trends, AI adoption patterns, and what's powering successful products.
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
              More research and insights coming soon.
            </p>
            <Link href="/">
              <Button variant="outline">
                Back to Scanner
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
