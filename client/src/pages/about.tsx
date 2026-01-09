import { Link } from "wouter";
import { ArrowLeft, Cpu, Target, Eye, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function About() {
  return (
    <div className="min-h-screen noise bg-background">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/">
          <Button variant="ghost" className="mb-8 -ml-4" data-testid="link-back-home">
            <ArrowLeft className="mr-2 w-4 h-4" />
            Back to Home
          </Button>
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-display text-4xl font-bold">About AIHackr</h1>
        </div>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="font-display text-2xl font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              What We Do
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              AIHackr is a technology detection tool that reverse-engineers websites to reveal their tech stack. 
              We analyze publicly accessible information to identify frameworks, hosting providers, payment systems, 
              authentication services, analytics tools, and AI providers.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Think of us as "BuiltWith for AI SaaS" with transparent detection methodology and confidence levels 
              for every claim we make.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              How It Works
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We use a multi-phase scanning approach:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong className="text-foreground">Passive Scan:</strong> Analyzes HTML, HTTP headers, and DNS records instantly</li>
              <li><strong className="text-foreground">Render Scan:</strong> Loads the page in a browser to capture network activity</li>
              <li><strong className="text-foreground">Probe Scan:</strong> Optionally interacts with the page to detect AI features</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Each detection includes confidence levels and evidence trails so you know exactly what we found and why.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Our Principles
            </h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong className="text-foreground">Transparency:</strong> We show our evidence for every detection</li>
              <li><strong className="text-foreground">Accuracy:</strong> We use confidence levels rather than false certainty</li>
              <li><strong className="text-foreground">Respect:</strong> We only analyze publicly accessible information</li>
              <li><strong className="text-foreground">Privacy:</strong> We don't store data from scanned websites</li>
            </ul>
          </section>

          <section className="pt-8 border-t border-border">
            <p className="text-muted-foreground text-sm">
              Built with curiosity about what powers the web.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
