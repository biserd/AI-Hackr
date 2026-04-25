import { BlogPostScaffold } from "@/components/blog-post";

export default function Post() {
  return (
    <BlogPostScaffold
      slug="aws-bedrock-customers-the-complete-list"
      title="AWS Bedrock Customers: The Complete List"
      description="Every SaaS product AIHackr has detected running Anthropic, Llama, or Titan models through AWS Bedrock — refreshed weekly."
      publishedTime="2026-04-13T00:00:00Z"
      displayDate="April 2026"
      category="Provider Spotlight"
      keywords="AWS Bedrock customers, Bedrock SaaS, who uses AWS Bedrock, Bedrock Anthropic customers, Bedrock Claude"
      leads={[
        "AWS Bedrock has become the easiest path to production Claude for any team already on AWS — single bill, IAM, VPC endpoints, and no new vendor onboarding. We track every product where Bedrock shows up in the wire signals.",
      ]}
      sections={[
        {
          heading: "Bedrock's detection fingerprint",
          bullets: [
            "Hostnames: bedrock-runtime.*.amazonaws.com and bedrock-agent-runtime.*.amazonaws.com.",
            "Path includes /model/anthropic.claude-* or /model/meta.llama-* identifiers.",
            "AWS SigV4 signed Authorization headers.",
          ],
        },
        {
          heading: "What Bedrock customers have in common",
          bullets: [
            "Already heavy AWS workloads — VPC, RDS, S3 — and want one bill.",
            "Compliance teams that have already approved AWS BAA and SOC 2.",
            "Need Anthropic but want it routed through their AWS account boundary.",
          ],
        },
        {
          heading: "How to read the live list",
          bullets: [
            "The provider rollup below is generated from the most recent scan cycle.",
            "Companies appear/disappear as they migrate between Bedrock and Anthropic direct.",
          ],
        },
      ]}
      related={{
        providers: [
          { name: "AWS Bedrock", slug: "aws-bedrock" },
          { name: "Anthropic", slug: "anthropic" },
          { name: "Meta Llama", slug: "meta-llama" },
        ],
        companies: [
          { name: "Stripe", slug: "stripe" },
          { name: "Datadog", slug: "datadog" },
        ],
        posts: [
          { title: "Azure OpenAI adoption in enterprise SaaS", slug: "azure-openai-adoption-in-enterprise-saas" },
          { title: "Claude vs GPT-4: real-world deployments", slug: "claude-vs-gpt-4-real-world-saas-deployments" },
        ],
      }}
    />
  );
}
