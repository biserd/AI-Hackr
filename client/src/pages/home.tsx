import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Search, 
  ArrowRight, 
  Zap, 
  Eye, 
  Shield,
  Code2,
  Server,
  CreditCard,
  Lock,
  BarChart3,
  Cpu,
  Share2,
  History,
  ExternalLink,
  Check,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

function Navbar() {
  return (
    <motion.nav 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl"
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display font-semibold text-lg tracking-tight">AIHackr</span>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" data-testid="link-sample">
            Sample Report
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" data-testid="link-pricing">
            Pricing
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary" data-testid="button-nav-scan">
            Scan URL
          </Button>
        </div>
      </div>
    </motion.nav>
  );
}

function Hero() {
  const [url, setUrl] = useState("");

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div 
        initial="initial"
        animate="animate"
        variants={stagger}
        className="relative z-10 max-w-4xl mx-auto px-6 text-center"
      >
        <motion.div variants={fadeInUp} className="mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium font-mono">
            <Sparkles className="w-4 h-4" />
            The "BuiltWith" for AI SaaS
          </span>
        </motion.div>
        
        <motion.h1 
          variants={fadeInUp}
          className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]"
        >
          What's this SaaS built with—
          <span className="text-gradient glow-text block mt-2">especially the AI stack?</span>
        </motion.h1>
        
        <motion.p 
          variants={fadeInUp}
          className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Paste a URL to get a shareable Stack Card: framework, hosting, Stripe/auth/analytics—and AI provider signals when they're publicly detectable (with confidence levels and evidence).
        </motion.p>
        
        <motion.div variants={fadeInUp} className="max-w-xl mx-auto mb-6">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 via-secondary/50 to-primary/50 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-500" />
            <div className="relative flex gap-2 p-2 bg-card border border-border rounded-xl">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="url"
                  placeholder="example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-12 h-14 bg-background border-0 text-lg font-mono placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                  data-testid="input-url"
                />
              </div>
              <Button 
                size="lg" 
                className="h-14 px-8 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold glow-primary group/btn"
                data-testid="button-scan"
              >
                Scan a URL
                <ArrowRight className="ml-2 w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </motion.div>
        
        <motion.div variants={fadeInUp} className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 text-secondary" />
            Free passive scan
          </span>
          <span className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Probe scan for deeper detection
          </span>
        </motion.div>
        
        <motion.div variants={fadeInUp} className="mt-6">
          <Button variant="link" className="text-muted-foreground hover:text-primary" data-testid="link-sample-report">
            See a sample report
            <ExternalLink className="ml-2 w-4 h-4" />
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}

function ProblemSection() {
  const bullets = [
    { icon: Eye, text: "See the stack in seconds (Next/Vercel/Stripe/Clerk/etc.)" },
    { icon: Cpu, text: "Detect AI provider signals when they leak (OpenAI / Gemini / Anthropic / Azure)" },
    { icon: Shield, text: "Every claim comes with evidence + confidence (High / Medium / Low)" }
  ];

  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/50 to-transparent" />
      <motion.div 
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        variants={stagger}
        className="relative max-w-4xl mx-auto px-6"
      >
        <motion.h2 
          variants={fadeInUp}
          className="font-display text-3xl sm:text-4xl font-bold text-center mb-4"
        >
          Stop guessing what competitors are running.
        </motion.h2>
        <motion.p 
          variants={fadeInUp}
          className="text-muted-foreground text-center text-lg mb-16 max-w-2xl mx-auto"
        >
          Get hard evidence on any SaaS tech stack in seconds.
        </motion.p>
        
        <div className="grid gap-6">
          {bullets.map((item, i) => (
            <motion.div
              key={i}
              variants={fadeInUp}
              className="group flex items-start gap-5 p-6 rounded-xl border border-border bg-card/50 hover:border-primary/30 hover:bg-card transition-all duration-300"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <item.icon className="w-6 h-6 text-primary" />
              </div>
              <p className="text-lg pt-2 text-foreground/90">{item.text}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: "We scan the public surface",
      desc: "HTML, headers, scripts, DNS records—everything publicly visible."
    },
    {
      num: "02",
      title: "Optional probe scan",
      desc: "Captures network calls during real interactions for deeper detection."
    },
    {
      num: "03",
      title: "Get your AI Stack Card",
      desc: "Receipts, confidence levels, and a shareable badge."
    }
  ];

  return (
    <section className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-50" />
      <motion.div 
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        variants={stagger}
        className="relative max-w-5xl mx-auto px-6"
      >
        <motion.div variants={fadeInUp} className="text-center mb-20">
          <span className="text-primary font-mono text-sm tracking-wider uppercase">Process</span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-3">How it works</h2>
        </motion.div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              variants={fadeInUp}
              className="relative group"
            >
              <div className="absolute -top-4 left-0 font-display text-6xl font-bold text-primary/10 group-hover:text-primary/20 transition-colors">
                {step.num}
              </div>
              <div className="relative pt-12 pb-8 px-6 rounded-xl border border-border bg-card/30 hover:border-primary/30 transition-colors h-full">
                <h3 className="font-display text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-px bg-gradient-to-r from-border to-transparent" />
              )}
            </motion.div>
          ))}
        </div>
        
        <motion.div variants={fadeInUp} className="text-center mt-16">
          <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary" data-testid="button-run-scan">
            Run a scan
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}

function Deliverables() {
  const items = [
    { icon: Code2, label: "Stack Summary", desc: "Framework, hosting/CDN, payments, auth, analytics, support" },
    { icon: Cpu, label: "AI Layer", desc: "Provider / gateway signals + transport (streaming/ws)" },
    { icon: Eye, label: "Evidence", desc: "Observed domains, script signatures, request patterns" },
    { icon: Share2, label: "Share Card", desc: "Public URL + embed badge for your site" },
    { icon: History, label: "Change History", desc: "What changed since last scan (Pro)" }
  ];

  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      <motion.div 
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        variants={stagger}
        className="relative max-w-5xl mx-auto px-6"
      >
        <motion.div variants={fadeInUp} className="text-center mb-16">
          <span className="text-primary font-mono text-sm tracking-wider uppercase">Deliverables</span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-3">What you get</h2>
          <p className="text-muted-foreground mt-4 text-lg">Your report includes everything you need to understand any SaaS.</p>
        </motion.div>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <motion.div
              key={i}
              variants={fadeInUp}
              className="group p-6 rounded-xl border border-border bg-card/50 hover:border-primary/30 hover:bg-card transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">{item.label}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
        
        <motion.div variants={fadeInUp} className="text-center mt-12">
          <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary" data-testid="button-generate-card">
            Generate my Stack Card
            <Sparkles className="ml-2 w-5 h-5" />
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}

function Sharing() {
  return (
    <section className="py-32 relative">
      <motion.div 
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        variants={stagger}
        className="max-w-4xl mx-auto px-6 text-center"
      >
        <motion.div variants={fadeInUp}>
          <span className="text-primary font-mono text-sm tracking-wider uppercase">Virality</span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-3 mb-4">Make it shareable</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-10">
            Post your AI Stack Card on X/LinkedIn—or drop the badge in your footer.
          </p>
        </motion.div>
        
        <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="outline" size="lg" className="border-border hover:border-primary/50 hover:bg-primary/5" data-testid="button-view-sample">
            View sample card
            <ExternalLink className="ml-2 w-4 h-4" />
          </Button>
          <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary" data-testid="button-scan-product">
            Scan my product
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}

function Pricing() {
  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/50 to-transparent" />
      <motion.div 
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        variants={stagger}
        className="relative max-w-4xl mx-auto px-6"
      >
        <motion.div variants={fadeInUp} className="text-center mb-16">
          <span className="text-primary font-mono text-sm tracking-wider uppercase">Pricing</span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-3">Simple, transparent pricing</h2>
        </motion.div>
        
        <div className="grid md:grid-cols-2 gap-8">
          <motion.div
            variants={fadeInUp}
            className="p-8 rounded-2xl border border-border bg-card/50"
          >
            <h3 className="font-display text-2xl font-bold mb-2">Free</h3>
            <p className="text-muted-foreground mb-6">Perfect for quick checks</p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3 text-sm">
                <Check className="w-4 h-4 text-secondary flex-shrink-0" />
                Passive scan
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="w-4 h-4 text-secondary flex-shrink-0" />
                Public Stack Card
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="w-4 h-4 text-secondary flex-shrink-0" />
                Share badge
              </li>
            </ul>
            <Button variant="outline" className="w-full" data-testid="button-start-free">
              Start free
            </Button>
          </motion.div>
          
          <motion.div
            variants={fadeInUp}
            className="relative p-8 rounded-2xl border border-primary/30 bg-card"
          >
            <div className="absolute -top-3 left-8 px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
              Popular
            </div>
            <h3 className="font-display text-2xl font-bold mb-2">Pro</h3>
            <p className="text-muted-foreground mb-6">For serious competitive analysis</p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3 text-sm">
                <Check className="w-4 h-4 text-secondary flex-shrink-0" />
                Probe scans
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="w-4 h-4 text-secondary flex-shrink-0" />
                Monitoring & change alerts
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="w-4 h-4 text-secondary flex-shrink-0" />
                Exports & API access
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Check className="w-4 h-4 text-secondary flex-shrink-0" />
                Change history
              </li>
            </ul>
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 glow-primary" data-testid="button-view-pricing">
              View pricing
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

function Footer() {
  const [url, setUrl] = useState("");

  return (
    <footer className="py-24 relative border-t border-border">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <motion.div 
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        variants={stagger}
        className="relative max-w-4xl mx-auto px-6 text-center"
      >
        <motion.h2 variants={fadeInUp} className="font-display text-3xl sm:text-4xl font-bold mb-8">
          Ready to reverse-engineer a SaaS?
        </motion.h2>
        
        <motion.div variants={fadeInUp} className="max-w-xl mx-auto mb-8">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 via-secondary/50 to-primary/50 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-500" />
            <div className="relative flex gap-2 p-2 bg-card border border-border rounded-xl">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="url"
                  placeholder="example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-12 h-12 bg-background border-0 font-mono placeholder:text-muted-foreground/50 focus-visible:ring-0"
                  data-testid="input-footer-url"
                />
              </div>
              <Button className="h-12 px-6 bg-primary text-primary-foreground hover:bg-primary/90 glow-primary" data-testid="button-footer-scan">
                Scan URL
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.div>
        
        <motion.div variants={fadeInUp}>
          <Button variant="link" className="text-muted-foreground hover:text-primary" data-testid="link-footer-sample">
            View sample report
            <ExternalLink className="ml-2 w-4 h-4" />
          </Button>
        </motion.div>
        
        <motion.div variants={fadeInUp} className="mt-16 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Cpu className="w-3 h-3 text-primary" />
            </div>
            <span className="font-display font-medium text-sm">AIHackr</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2025 AIHackr. Built for builders.
          </p>
        </motion.div>
      </motion.div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen noise">
      <Navbar />
      <Hero />
      <ProblemSection />
      <HowItWorks />
      <Deliverables />
      <Sharing />
      <Pricing />
      <Footer />
    </div>
  );
}
