import { BlogPostScaffold } from "@/components/blog-post";

export default function Post() {
  return (
    <BlogPostScaffold
      slug="how-to-tell-which-llm-a-website-is-using"
      title="How to Tell Which LLM a Website Is Using"
      description="A practical, evidence-based guide to fingerprinting any website's AI provider — the same techniques AIHackr uses, distilled into a checklist."
      publishedTime="2026-04-16T00:00:00Z"
      displayDate="April 2026"
      category="How-to"
      keywords="how to tell which AI a website uses, LLM detection, fingerprint AI provider, what AI does this site use"
      leads={[
        "If you've ever wanted to know whether a chatbot was really running GPT-4 or actually a fine-tuned Llama, here's the playbook. None of this requires special access — just devtools and a careful eye.",
      ]}
      sections={[
        {
          heading: "Step 1: open the network tab and chat",
          bullets: [
            "Filter by Fetch/XHR. Trigger an AI response.",
            "Look at the host of the streaming/POST request: api.openai.com, api.anthropic.com, *.azure.com, *.amazonaws.com, etc.",
          ],
        },
        {
          heading: "Step 2: check the request and response shape",
          bullets: [
            "OpenAI: choices[].delta.content streaming with role/content fields.",
            "Anthropic: content_block_delta SSE events; system top-level field in request.",
            "Bedrock: bytes-encoded Eventstream chunks; SigV4 Authorization header.",
          ],
        },
        {
          heading: "Step 3: handle gateways",
          bullets: [
            "If the host is a gateway (gateway.ai.cloudflare.com, api.portkey.ai, *.helicone.ai), the request body usually still names the underlying model.",
            "Look for 'model': 'gpt-4o' / 'claude-3-5-sonnet-20240620' inside the JSON body.",
          ],
        },
        {
          heading: "Step 4: validate against AIHackr",
          bullets: [
            "Paste the URL into AIHackr to cross-check your manual fingerprint against ours.",
            "If we disagree, the evidence trail will show you exactly which signal we relied on.",
          ],
        },
      ]}
      related={{
        providers: [
          { name: "OpenAI", slug: "openai" },
          { name: "Anthropic", slug: "anthropic" },
          { name: "Azure OpenAI", slug: "azure-openai" },
        ],
        companies: [
          { name: "Notion", slug: "notion" },
          { name: "Intercom", slug: "intercom" },
        ],
        posts: [
          { title: "The complete guide to fingerprinting AI providers", slug: "the-complete-guide-to-fingerprinting-ai-providers" },
          { title: "AI Gateways Explained", slug: "ai-gateways-explained-cloudflare-portkey-helicone" },
        ],
      }}
    />
  );
}
