import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Sparkles,
  ChevronDown,
  X,
  Loader2,
  Globe,
  Activity,
  Users,
  TrendingUp,
  Quote,
  Minus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { useScan } from "@/hooks/use-scan";

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

const techLogos = [
  { name: "Next.js", color: "#000000", bg: "#ffffff" },
  { name: "Vercel", color: "#000000", bg: "#ffffff" },
  { name: "Stripe", color: "#635BFF", bg: "#635BFF20" },
  { name: "OpenAI", color: "#10A37F", bg: "#10A37F20" },
  { name: "Anthropic", color: "#D4A574", bg: "#D4A57420" },
  { name: "Clerk", color: "#6C47FF", bg: "#6C47FF20" },
  { name: "Supabase", color: "#3ECF8E", bg: "#3ECF8E20" },
  { name: "Firebase", color: "#FFCA28", bg: "#FFCA2820" },
  { name: "AWS", color: "#FF9900", bg: "#FF990020" },
  { name: "Azure", color: "#0078D4", bg: "#0078D420" },
  { name: "Cloudflare", color: "#F38020", bg: "#F3802020" },
  { name: "Segment", color: "#52BD94", bg: "#52BD9420" },
  { name: "Mixpanel", color: "#7856FF", bg: "#7856FF20" },
  { name: "Intercom", color: "#1F8DED", bg: "#1F8DED20" },
  { name: "Auth0", color: "#EB5424", bg: "#EB542420" },
  { name: "Gemini", color: "#8E75B2", bg: "#8E75B220" },
];

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
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" data-testid="link-sample">
            Sample Report
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" data-testid="link-pricing">
            Pricing
          </Button>
          <ThemeToggle />
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary" data-testid="button-nav-scan">
            Scan URL
          </Button>
        </div>
      </div>
    </motion.nav>
  );
}

function StickyBar() {
  const [isVisible, setIsVisible] = useState(false);
  const [url, setUrl] = useState("");
  const { scanUrl, isScanning } = useScan();

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 600);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleScan = () => {
    scanUrl(url);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4"
        >
          <div className="flex gap-2 p-2 bg-card/95 border border-border backdrop-blur-xl rounded-2xl shadow-2xl">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="url"
                placeholder="example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isScanning}
                className="pl-10 h-10 bg-background border-0 font-mono text-sm placeholder:text-muted-foreground/50 focus-visible:ring-0"
                data-testid="input-sticky-url"
              />
            </div>
            <Button 
              onClick={handleScan}
              disabled={isScanning}
              className="h-10 px-5 bg-primary text-primary-foreground hover:bg-primary/90 glow-primary text-sm" 
              data-testid="button-sticky-scan"
            >
              {isScanning ? (
                <>
                  <Loader2 className="ml-1 w-4 h-4 animate-spin" />
                </>
              ) : (
                <>
                  Scan
                  <ArrowRight className="ml-1 w-4 h-4" />
                </>
              )}
            </Button>
            <Button variant="ghost" size="sm" className="h-10 text-muted-foreground hover:text-foreground text-xs" data-testid="link-sticky-sample">
              Sample
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Hero() {
  const [url, setUrl] = useState("");
  const { scanUrl, isScanning } = useScan();

  const handleScan = () => {
    scanUrl(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isScanning) {
      handleScan();
    }
  };

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
                  onKeyDown={handleKeyDown}
                  disabled={isScanning}
                  className="pl-12 h-14 bg-background border-0 text-lg font-mono placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                  data-testid="input-url"
                />
              </div>
              <Button 
                size="lg"
                onClick={handleScan}
                disabled={isScanning}
                className="h-14 px-8 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold glow-primary group/btn"
                data-testid="button-scan"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    Scan a URL
                    <ArrowRight className="ml-2 w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                  </>
                )}
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

function TechMarquee() {
  return (
    <section className="py-16 overflow-hidden border-y border-border/50 bg-card/30">
      <div className="max-w-6xl mx-auto px-6 mb-8">
        <p className="text-center text-muted-foreground text-sm font-medium uppercase tracking-wider">
          Detect frameworks, hosting, payments, auth, analytics & AI providers
        </p>
      </div>
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10" />
        <motion.div
          animate={{ x: [0, -1920] }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          className="flex gap-6"
        >
          {[...techLogos, ...techLogos, ...techLogos].map((tech, i) => (
            <div
              key={i}
              className="flex-shrink-0 px-5 py-3 rounded-lg border border-border bg-card/50 flex items-center gap-3 hover:border-primary/30 transition-colors"
            >
              <div 
                className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: tech.bg, color: tech.color }}
              >
                {tech.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="font-medium text-sm whitespace-nowrap">{tech.name}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Stats() {
  const stats = [
    { value: "47,000+", label: "SaaS Products Scanned", icon: Globe },
    { value: "156", label: "Tech Signatures Detected", icon: Activity },
    { value: "12,000+", label: "Stack Cards Generated", icon: Users },
    { value: "94%", label: "Detection Accuracy", icon: TrendingUp },
  ];

  return (
    <section className="py-20 relative">
      <motion.div 
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        variants={stagger}
        className="max-w-5xl mx-auto px-6"
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              variants={fadeInUp}
              className="text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                <stat.icon className="w-6 h-6 text-primary" />
              </div>
              <div className="font-display text-3xl sm:text-4xl font-bold text-gradient mb-2">{stat.value}</div>
              <div className="text-muted-foreground text-sm">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

function LiveDemo() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const scanSteps = [
    "Fetching HTML & headers...",
    "Analyzing script signatures...",
    "Checking DNS records...",
    "Detecting AI provider signals...",
    "Generating Stack Card..."
  ];

  const startScan = () => {
    setIsScanning(true);
    setScanComplete(false);
    setCurrentStep(0);
    
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= scanSteps.length - 1) {
          clearInterval(interval);
          setTimeout(() => {
            setIsScanning(false);
            setScanComplete(true);
          }, 800);
          return prev;
        }
        return prev + 1;
      });
    }, 600);
  };

  const resetDemo = () => {
    setScanComplete(false);
    setIsScanning(false);
    setCurrentStep(0);
  };

  return (
    <section className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      <motion.div 
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        variants={stagger}
        className="relative max-w-5xl mx-auto px-6"
      >
        <motion.div variants={fadeInUp} className="text-center mb-16">
          <span className="text-primary font-mono text-sm tracking-wider uppercase">Live Demo</span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-3">See it in action</h2>
          <p className="text-muted-foreground mt-4 text-lg">Watch how we reverse-engineer a SaaS in seconds.</p>
        </motion.div>

        <motion.div variants={fadeInUp} className="max-w-2xl mx-auto">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
              <div className="w-3 h-3 rounded-full bg-destructive/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-secondary/60" />
              <span className="ml-4 text-xs text-muted-foreground font-mono">aihackr.io/scan</span>
            </div>
            
            <div className="p-8">
              {!isScanning && !scanComplete && (
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 border border-border mb-6 font-mono text-sm">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    linear.app
                  </div>
                  <div>
                    <Button onClick={startScan} className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary" data-testid="button-demo-scan">
                      <Zap className="mr-2 w-4 h-4" />
                      Run Demo Scan
                    </Button>
                  </div>
                </div>
              )}

              {isScanning && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    <span className="font-mono text-sm text-primary">Scanning linear.app...</span>
                  </div>
                  {scanSteps.map((step, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: i <= currentStep ? 1 : 0.3, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-3"
                    >
                      {i < currentStep ? (
                        <Check className="w-4 h-4 text-secondary" />
                      ) : i === currentStep ? (
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-border" />
                      )}
                      <span className={`font-mono text-sm ${i <= currentStep ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}

              {scanComplete && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#5E6AD2] flex items-center justify-center text-white font-bold text-sm">Li</div>
                      <div>
                        <div className="font-semibold">linear.app</div>
                        <div className="text-xs text-muted-foreground">Scanned just now</div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={resetDemo} data-testid="button-demo-reset">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Framework", value: "Next.js", confidence: "High" },
                      { label: "Hosting", value: "Vercel", confidence: "High" },
                      { label: "Auth", value: "Custom", confidence: "Medium" },
                      { label: "Analytics", value: "Segment", confidence: "High" },
                    ].map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                        <div className="font-medium text-sm">{item.value}</div>
                        <div className={`text-xs mt-1 ${item.confidence === 'High' ? 'text-secondary' : 'text-yellow-500'}`}>
                          {item.confidence} confidence
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Cpu className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-sm">AI Layer Detected</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-primary font-medium">OpenAI GPT-4</span>
                      <span className="text-muted-foreground"> via api.openai.com</span>
                    </div>
                    <div className="text-xs text-secondary mt-1">High confidence • Streaming enabled</div>
                  </div>

                  <div className="flex gap-2">
                    <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-demo-full">
                      View Full Report
                    </Button>
                    <Button variant="outline" className="flex-1" data-testid="button-demo-share">
                      <Share2 className="mr-2 w-4 h-4" />
                      Share Card
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

function StackCardPreview() {
  return (
    <section className="py-32 relative">
      <motion.div 
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        variants={stagger}
        className="max-w-5xl mx-auto px-6"
      >
        <motion.div variants={fadeInUp} className="text-center mb-16">
          <span className="text-primary font-mono text-sm tracking-wider uppercase">Stack Card</span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-3">Your shareable report</h2>
          <p className="text-muted-foreground mt-4 text-lg">Every scan generates a beautiful, embeddable Stack Card.</p>
        </motion.div>

        <motion.div variants={fadeInUp} className="max-w-lg mx-auto">
          <div className="relative group">
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-secondary/20 to-accent/20 rounded-3xl blur-xl opacity-50 group-hover:opacity-75 transition duration-500" />
            <div className="relative rounded-2xl border border-border bg-card overflow-hidden">
              <div className="p-6 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">No</div>
                  <div>
                    <h3 className="font-display text-xl font-bold">notion.so</h3>
                    <p className="text-sm text-muted-foreground">Scanned Dec 15, 2024</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Framework", value: "React", icon: Code2 },
                    { label: "Hosting", value: "AWS", icon: Server },
                    { label: "Payments", value: "Stripe", icon: CreditCard },
                  ].map((item, i) => (
                    <div key={i} className="text-center p-3 rounded-lg bg-muted/30">
                      <item.icon className="w-5 h-5 text-primary mx-auto mb-2" />
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div className="font-medium text-sm">{item.value}</div>
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Auth", value: "Custom", icon: Lock },
                    { label: "Analytics", value: "Amplitude", icon: BarChart3 },
                    { label: "Support", value: "Intercom", icon: Users },
                  ].map((item, i) => (
                    <div key={i} className="text-center p-3 rounded-lg bg-muted/30">
                      <item.icon className="w-5 h-5 text-primary mx-auto mb-2" />
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div className="font-medium text-sm">{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className="w-5 h-5 text-primary" />
                    <span className="font-semibold">AI Stack</span>
                    <span className="ml-auto text-xs px-2 py-1 rounded-full bg-secondary/20 text-secondary font-medium">High Confidence</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Provider</span>
                      <span className="font-medium">OpenAI + Anthropic</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transport</span>
                      <span className="font-medium">Streaming SSE</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gateway</span>
                      <span className="font-medium">Custom proxy</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Cpu className="w-3 h-3" />
                  <span>Generated by AIHackr</span>
                </div>
                <Button variant="ghost" size="sm" className="text-xs" data-testid="button-share-card">
                  <Share2 className="w-3 h-3 mr-1" />
                  Share
                </Button>
              </div>
            </div>
          </div>
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

function ComparisonTable() {
  const features = [
    { name: "Passive stack detection", aihackr: true, builtwith: true, manual: false },
    { name: "AI provider detection", aihackr: true, builtwith: false, manual: "partial" },
    { name: "Confidence levels", aihackr: true, builtwith: false, manual: false },
    { name: "Evidence & receipts", aihackr: true, builtwith: false, manual: "partial" },
    { name: "Probe scan (deep detection)", aihackr: true, builtwith: false, manual: true },
    { name: "Shareable cards", aihackr: true, builtwith: true, manual: false },
    { name: "Change monitoring", aihackr: "pro", builtwith: true, manual: false },
    { name: "API access", aihackr: "pro", builtwith: true, manual: false },
    { name: "Time to results", aihackr: "~10s", builtwith: "~30s", manual: "hours" },
  ];

  const renderCell = (value: boolean | string) => {
    if (value === true) return <Check className="w-5 h-5 text-secondary mx-auto" />;
    if (value === false) return <X className="w-5 h-5 text-muted-foreground/40 mx-auto" />;
    if (value === "partial") return <Minus className="w-5 h-5 text-yellow-500 mx-auto" />;
    if (value === "pro") return <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-medium">Pro</span>;
    return <span className="text-sm text-muted-foreground">{value}</span>;
  };

  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/30 to-transparent" />
      <motion.div 
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        variants={stagger}
        className="relative max-w-4xl mx-auto px-6"
      >
        <motion.div variants={fadeInUp} className="text-center mb-16">
          <span className="text-primary font-mono text-sm tracking-wider uppercase">Comparison</span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-3">How we stack up</h2>
        </motion.div>

        <motion.div variants={fadeInUp} className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-4 px-4 font-medium text-muted-foreground">Feature</th>
                <th className="text-center py-4 px-4">
                  <div className="inline-flex items-center gap-2 text-primary font-semibold">
                    <Cpu className="w-4 h-4" />
                    AIHackr
                  </div>
                </th>
                <th className="text-center py-4 px-4 font-medium text-muted-foreground">BuiltWith</th>
                <th className="text-center py-4 px-4 font-medium text-muted-foreground">Manual</th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-4 px-4 text-sm">{feature.name}</td>
                  <td className="py-4 px-4 text-center">{renderCell(feature.aihackr)}</td>
                  <td className="py-4 px-4 text-center">{renderCell(feature.builtwith)}</td>
                  <td className="py-4 px-4 text-center">{renderCell(feature.manual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </motion.div>
    </section>
  );
}

function Testimonials() {
  const testimonials = [
    {
      quote: "Finally, a tool that tells me if my competitors are using GPT-4 or Claude. Game changer for our product strategy.",
      author: "Sarah Chen",
      role: "VP Product, Stealth AI Startup",
      avatar: "SC"
    },
    {
      quote: "We use AIHackr before every competitive analysis. The confidence levels and evidence make our reports bulletproof.",
      author: "Marcus Johnson",
      role: "Founder, TechWatch.io",
      avatar: "MJ"
    },
    {
      quote: "The probe scan feature caught API calls we never would have found manually. Worth every penny.",
      author: "Alex Rivera",
      role: "CTO, Buildspace",
      avatar: "AR"
    }
  ];

  return (
    <section className="py-32 relative">
      <motion.div 
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        variants={stagger}
        className="max-w-5xl mx-auto px-6"
      >
        <motion.div variants={fadeInUp} className="text-center mb-16">
          <span className="text-primary font-mono text-sm tracking-wider uppercase">Testimonials</span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-3">Loved by builders</h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((item, i) => (
            <motion.div
              key={i}
              variants={fadeInUp}
              className="p-6 rounded-2xl border border-border bg-card/50 hover:border-primary/30 transition-colors"
            >
              <Quote className="w-8 h-8 text-primary/30 mb-4" />
              <p className="text-foreground/90 leading-relaxed mb-6">"{item.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-sm font-bold">
                  {item.avatar}
                </div>
                <div>
                  <div className="font-medium text-sm">{item.author}</div>
                  <div className="text-xs text-muted-foreground">{item.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
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

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: "How accurate is the detection?",
      a: "Our passive scans achieve 94% accuracy on framework, hosting, and major integrations. AI provider detection depends on public signals—we only report what we can verify, with confidence levels for each claim."
    },
    {
      q: "What can't you detect?",
      a: "We can't see internal infrastructure, databases, or AI calls routed through custom proxies that strip identifying headers. That's why we show confidence levels—if we're not sure, we tell you."
    },
    {
      q: "Is this legal?",
      a: "Yes. We only analyze publicly accessible information: HTML, HTTP headers, JavaScript files, and DNS records. This is the same data any browser sees when loading a website."
    },
    {
      q: "What's the difference between passive and probe scans?",
      a: "Passive scans analyze static assets. Probe scans actually interact with the site (click buttons, fill forms) and capture network calls during those interactions—revealing APIs and services that only activate on user actions."
    },
    {
      q: "How do you detect AI providers?",
      a: "We look for telltale signs: OpenAI/Anthropic/Google API domains in network calls, specific request patterns, streaming responses, and JavaScript SDKs. When we detect signals, we show exactly what we found."
    },
    {
      q: "Can I scan my own product?",
      a: "Absolutely! Many teams use AIHackr to audit their own stack visibility. If you're leaking AI provider info you'd rather keep private, we'll show you exactly where."
    }
  ];

  return (
    <section className="py-32 relative">
      <motion.div 
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        variants={stagger}
        className="max-w-3xl mx-auto px-6"
      >
        <motion.div variants={fadeInUp} className="text-center mb-16">
          <span className="text-primary font-mono text-sm tracking-wider uppercase">FAQ</span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-3">Common questions</h2>
        </motion.div>

        <motion.div variants={fadeInUp} className="space-y-4">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="border border-border rounded-xl overflow-hidden bg-card/30 hover:border-primary/30 transition-colors"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-6 text-left"
                data-testid={`faq-toggle-${i}`}
              >
                <span className="font-medium pr-4">{faq.q}</span>
                <ChevronDown className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform ${openIndex === i ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 text-muted-foreground leading-relaxed">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
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
  const { scanUrl, isScanning } = useScan();

  const handleScan = () => {
    scanUrl(url);
  };

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
                  disabled={isScanning}
                  className="pl-12 h-12 bg-background border-0 font-mono placeholder:text-muted-foreground/50 focus-visible:ring-0"
                  data-testid="input-footer-url"
                />
              </div>
              <Button 
                onClick={handleScan}
                disabled={isScanning}
                className="h-12 px-6 bg-primary text-primary-foreground hover:bg-primary/90 glow-primary" 
                data-testid="button-footer-scan"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    Scan URL
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </>
                )}
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
      <StickyBar />
      <Hero />
      <TechMarquee />
      <Stats />
      <LiveDemo />
      <StackCardPreview />
      <ProblemSection />
      <HowItWorks />
      <ComparisonTable />
      <Testimonials />
      <Deliverables />
      <Sharing />
      <FAQ />
      <Pricing />
      <Footer />
    </div>
  );
}
