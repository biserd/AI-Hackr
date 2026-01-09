import { Link } from "wouter";
import { ArrowLeft, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Terms() {
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
          <h1 className="font-display text-4xl font-bold">Terms of Service</h1>
        </div>

        <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="font-display text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing and using AIHackr ("the Service"), you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              AIHackr is a technology detection tool that analyzes publicly accessible website information to 
              identify technology stacks, frameworks, and services. The Service provides analysis results based 
              on publicly observable data only.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-4">3. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed">You agree to use the Service only for lawful purposes. You shall not:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
              <li>Use the Service to scan websites you do not have permission to analyze</li>
              <li>Attempt to bypass any security measures or rate limits</li>
              <li>Use the Service to gather information for malicious purposes</li>
              <li>Redistribute or resell Service data without authorization</li>
              <li>Interfere with or disrupt the Service or its infrastructure</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-4">4. Accuracy of Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service provides technology detection based on pattern matching and heuristics. Results include 
              confidence levels to indicate detection certainty. We do not guarantee 100% accuracy and results 
              should be verified independently for critical decisions.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-4">5. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service, including its design, features, and content, is owned by AIHackr. Scan results 
              generated for URLs you submit may be shared publicly via shareable links.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-4">6. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service is provided "as is" without warranties of any kind. We shall not be liable for any 
              indirect, incidental, special, or consequential damages arising from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-4">7. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these terms at any time. Continued use of the Service after 
              changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-4">8. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these Terms, please contact us through our website.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
