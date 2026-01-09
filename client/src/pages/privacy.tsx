import { Link } from "wouter";
import { ArrowLeft, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Privacy() {
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
          <h1 className="font-display text-4xl font-bold">Privacy Policy</h1>
        </div>

        <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="font-display text-xl font-semibold mb-4">Overview</h2>
            <p className="text-muted-foreground leading-relaxed">
              AIHackr is committed to protecting your privacy. This policy explains how we collect, use, 
              and protect information when you use our technology detection service.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-4">Information We Collect</h2>
            
            <h3 className="font-display text-lg font-medium mb-2 mt-4">URLs You Submit</h3>
            <p className="text-muted-foreground leading-relaxed">
              When you scan a URL, we store the URL and our analysis results to enable shareable Stack Cards. 
              We do not store content from the scanned websites themselves.
            </p>

            <h3 className="font-display text-lg font-medium mb-2 mt-4">Usage Data</h3>
            <p className="text-muted-foreground leading-relaxed">
              We collect anonymous usage data including page views, scan counts, and feature usage to improve 
              the Service. This data is aggregated and cannot identify individual users.
            </p>

            <h3 className="font-display text-lg font-medium mb-2 mt-4">Analytics</h3>
            <p className="text-muted-foreground leading-relaxed">
              We use Google Analytics to understand how visitors use our site. This includes information like 
              pages visited, time on site, and general location data. You can opt out of Google Analytics 
              using browser extensions or settings.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-4">How We Use Information</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>To provide and improve the technology detection service</li>
              <li>To generate shareable Stack Card reports</li>
              <li>To analyze usage patterns and improve user experience</li>
              <li>To maintain and secure the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-4">Information Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell or rent your personal information. Scan results may be publicly accessible via 
              shareable links. We may share aggregated, anonymized data for research or business purposes.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-4">Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              Scan results are retained to enable shareable links. We may periodically remove old or 
              unused scan data.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-4">Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement reasonable security measures to protect the Service and stored data. However, 
              no internet transmission is completely secure.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-4">Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use third-party services including hosting providers and analytics. These services have 
              their own privacy policies governing data they collect.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-4">Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may request deletion of scan data associated with URLs you have submitted. Contact us 
              through our website to make such requests.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-4">Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this privacy policy from time to time. We will notify users of significant 
              changes by updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-4">Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about this Privacy Policy, please contact us through our website.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
