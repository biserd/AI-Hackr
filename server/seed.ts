import { db } from "./storage";
import { trackedCompanies, providerRollups } from "@shared/schema";
import { sql } from "drizzle-orm";

interface SeedCompany {
  slug: string;
  name: string;
  domain: string;
  url: string;
  category: string;
  ycBatch?: string;
  description: string;
  logoUrl?: string;
}

const SEED_COMPANIES: SeedCompany[] = [
  { slug: "notion", name: "Notion", domain: "notion.so", url: "https://www.notion.so", category: "Productivity", description: "All-in-one workspace with AI-powered writing assistance and Q&A." },
  { slug: "intercom", name: "Intercom", domain: "intercom.com", url: "https://www.intercom.com", category: "Customer Support", description: "AI-first customer service platform with Fin agent." },
  { slug: "zendesk", name: "Zendesk", domain: "zendesk.com", url: "https://www.zendesk.com", category: "Customer Support", description: "Customer experience suite with AI agents and copilots." },
  { slug: "hubspot", name: "HubSpot", domain: "hubspot.com", url: "https://www.hubspot.com", category: "CRM & Marketing", description: "CRM and marketing platform with Breeze AI." },
  { slug: "salesforce", name: "Salesforce", domain: "salesforce.com", url: "https://www.salesforce.com", category: "CRM & Marketing", description: "Enterprise CRM with Einstein and Agentforce." },
  { slug: "linear", name: "Linear", domain: "linear.app", url: "https://linear.app", category: "Productivity", description: "Issue tracker and project management with built-in AI." },
  { slug: "figma", name: "Figma", domain: "figma.com", url: "https://www.figma.com", category: "Design", description: "Collaborative design platform with Make AI features." },
  { slug: "canva", name: "Canva", domain: "canva.com", url: "https://www.canva.com", category: "Design", description: "Design platform with Magic Studio AI suite." },
  { slug: "grammarly", name: "Grammarly", domain: "grammarly.com", url: "https://www.grammarly.com", category: "Writing", description: "Writing assistant with generative AI features." },
  { slug: "duolingo", name: "Duolingo", domain: "duolingo.com", url: "https://www.duolingo.com", category: "Education", description: "Language learning app with AI-powered roleplay and explanations." },
  { slug: "cursor", name: "Cursor", domain: "cursor.com", url: "https://www.cursor.com", category: "Developer Tools", description: "AI-first code editor built on VS Code." },
  { slug: "github-copilot", name: "GitHub Copilot", domain: "github.com", url: "https://github.com/features/copilot", category: "Developer Tools", description: "AI pair programmer from GitHub and Microsoft." },
  { slug: "jasper", name: "Jasper", domain: "jasper.ai", url: "https://www.jasper.ai", category: "Marketing", description: "AI marketing platform for content generation." },
  { slug: "copy-ai", name: "Copy.ai", domain: "copy.ai", url: "https://www.copy.ai", category: "Marketing", description: "AI-powered GTM platform for sales and marketing." },
  { slug: "writesonic", name: "Writesonic", domain: "writesonic.com", url: "https://writesonic.com", category: "Marketing", description: "AI writing platform for SEO content." },
  { slug: "perplexity", name: "Perplexity", domain: "perplexity.ai", url: "https://www.perplexity.ai", category: "Search", description: "AI-powered answer engine with citations." },
  { slug: "harvey", name: "Harvey", domain: "harvey.ai", url: "https://www.harvey.ai", category: "Legal", description: "Domain-specific generative AI for legal professionals." },
  { slug: "casetext", name: "Casetext", domain: "casetext.com", url: "https://casetext.com", category: "Legal", description: "Legal AI assistant CoCounsel from Thomson Reuters." },
  { slug: "glean", name: "Glean", domain: "glean.com", url: "https://www.glean.com", category: "Enterprise Search", description: "AI-powered work assistant and enterprise search." },
  { slug: "guru", name: "Guru", domain: "getguru.com", url: "https://www.getguru.com", category: "Enterprise Search", description: "AI-driven enterprise search and knowledge management." },
  { slug: "workday", name: "Workday", domain: "workday.com", url: "https://www.workday.com", category: "HR & Finance", description: "Enterprise HR and finance platform with embedded AI." },
  { slug: "servicenow", name: "ServiceNow", domain: "servicenow.com", url: "https://www.servicenow.com", category: "ITSM", description: "Now Platform with Now Assist AI agents." },
  { slug: "freshdesk", name: "Freshdesk", domain: "freshworks.com", url: "https://www.freshworks.com/freshdesk/", category: "Customer Support", description: "Customer service software with Freddy AI." },
  { slug: "drift", name: "Drift", domain: "drift.com", url: "https://www.drift.com", category: "Sales", description: "Conversational AI for B2B revenue teams." },
  { slug: "gong", name: "Gong", domain: "gong.io", url: "https://www.gong.io", category: "Sales", description: "Revenue intelligence platform powered by AI." },
  { slug: "chorus", name: "Chorus", domain: "chorus.ai", url: "https://www.chorus.ai", category: "Sales", description: "Conversation intelligence from ZoomInfo." },
  { slug: "outreach", name: "Outreach", domain: "outreach.io", url: "https://www.outreach.io", category: "Sales", description: "Sales execution platform with AI assistance." },
  { slug: "salesloft", name: "Salesloft", domain: "salesloft.com", url: "https://www.salesloft.com", category: "Sales", description: "Revenue orchestration platform with Rhythm AI." },
  { slug: "apollo-io", name: "Apollo.io", domain: "apollo.io", url: "https://www.apollo.io", category: "Sales", description: "GTM platform with AI prospecting and outreach." },
  { slug: "clay", name: "Clay", domain: "clay.com", url: "https://www.clay.com", category: "Sales", description: "AI-native data enrichment and outbound platform." },
  { slug: "vercel", name: "Vercel", domain: "vercel.com", url: "https://vercel.com", category: "Developer Tools", description: "Frontend cloud with v0 AI generation." },
  { slug: "replit", name: "Replit", domain: "replit.com", url: "https://replit.com", category: "Developer Tools", description: "Browser-based IDE with Replit Agent." },
  { slug: "codeium", name: "Codeium", domain: "codeium.com", url: "https://codeium.com", category: "Developer Tools", description: "AI coding assistant and Windsurf editor." },
  { slug: "tabnine", name: "Tabnine", domain: "tabnine.com", url: "https://www.tabnine.com", category: "Developer Tools", description: "AI code completion for the enterprise." },
  { slug: "sourcegraph", name: "Sourcegraph", domain: "sourcegraph.com", url: "https://sourcegraph.com", category: "Developer Tools", description: "Code intelligence platform with Cody AI." },
  { slug: "jetbrains-ai", name: "JetBrains AI", domain: "jetbrains.com", url: "https://www.jetbrains.com/ai/", category: "Developer Tools", description: "AI Assistant integrated into JetBrains IDEs." },
  { slug: "sentry", name: "Sentry", domain: "sentry.io", url: "https://sentry.io", category: "Observability", description: "Application monitoring with AI-powered Autofix and Seer." },
  { slug: "datadog", name: "Datadog", domain: "datadoghq.com", url: "https://www.datadoghq.com", category: "Observability", description: "Observability platform with Bits AI assistant." },
  { slug: "new-relic", name: "New Relic", domain: "newrelic.com", url: "https://newrelic.com", category: "Observability", description: "Observability platform with NRDB GenAI." },
  { slug: "cloudflare", name: "Cloudflare", domain: "cloudflare.com", url: "https://www.cloudflare.com", category: "Infrastructure", description: "Edge platform with Workers AI and AI Gateway." },
  { slug: "brex", name: "Brex", domain: "brex.com", url: "https://www.brex.com", category: "Fintech", description: "Spend management platform with AI assistant." },
  { slug: "ramp", name: "Ramp", domain: "ramp.com", url: "https://ramp.com", category: "Fintech", description: "Finance automation platform with Ramp AI." },
  { slug: "stripe", name: "Stripe", domain: "stripe.com", url: "https://stripe.com", category: "Fintech", description: "Payments infrastructure with AI fraud and ops tooling." },
  { slug: "plaid", name: "Plaid", domain: "plaid.com", url: "https://plaid.com", category: "Fintech", description: "Financial data network with AI-powered tooling." },
  { slug: "rippling", name: "Rippling", domain: "rippling.com", url: "https://www.rippling.com", category: "HR & Finance", description: "Workforce platform with embedded AI workflows." },
  { slug: "deel", name: "Deel", domain: "deel.com", url: "https://www.deel.com", category: "HR & Finance", description: "Global HR platform with Deel AI." },
  { slug: "lattice", name: "Lattice", domain: "lattice.com", url: "https://lattice.com", category: "HR & People", description: "People platform with AI HRIS and reviews." },
  { slug: "leapsome", name: "Leapsome", domain: "leapsome.com", url: "https://www.leapsome.com", category: "HR & People", description: "People enablement platform with AI." },
  { slug: "typeform", name: "Typeform", domain: "typeform.com", url: "https://www.typeform.com", category: "Forms & Surveys", description: "Conversational forms with Formless AI." },
  { slug: "loom", name: "Loom", domain: "loom.com", url: "https://www.loom.com", category: "Video", description: "Async video with AI-generated summaries and titles." },
];

interface SeedProvider {
  slug: string;
  name: string;
  description: string;
  aliases: string[];
  sortOrder: number;
}

const SEED_PROVIDERS: SeedProvider[] = [
  {
    slug: "openai",
    name: "OpenAI",
    description: "Maker of GPT-4o, GPT-4 Turbo, and the o-series reasoning models. The most-adopted commercial LLM provider for SaaS today.",
    aliases: ["openai", "gpt", "gpt-4", "chatgpt"],
    sortOrder: 1,
  },
  {
    slug: "anthropic",
    name: "Anthropic",
    description: "Maker of the Claude family (Claude 3.5 Sonnet, Haiku, Opus). The leading enterprise-friendly LLM provider after OpenAI.",
    aliases: ["anthropic", "claude", "anthropic (claude)"],
    sortOrder: 2,
  },
  {
    slug: "google-gemini",
    name: "Google Gemini",
    description: "Google's Gemini family of models, served via the Gemini API and Vertex AI.",
    aliases: ["google", "gemini", "google gemini", "google (gemini)", "google vertex ai"],
    sortOrder: 3,
  },
  {
    slug: "azure-openai",
    name: "Azure OpenAI",
    description: "Microsoft's enterprise channel for OpenAI models, with private networking and compliance attestations.",
    aliases: ["azure", "azure_openai", "openai (azure)", "azure openai"],
    sortOrder: 4,
  },
  {
    slug: "aws-bedrock",
    name: "AWS Bedrock",
    description: "Amazon's multi-model LLM platform offering Anthropic, Meta, Mistral, and Amazon Titan models behind a single API.",
    aliases: ["bedrock", "aws bedrock", "amazon bedrock"],
    sortOrder: 5,
  },
  {
    slug: "mistral",
    name: "Mistral",
    description: "European AI lab behind the Mistral and Mixtral open-weight model families.",
    aliases: ["mistral", "api.mistral.ai"],
    sortOrder: 6,
  },
  {
    slug: "meta-llama",
    name: "Meta Llama",
    description: "Meta's open-weight Llama family — frequently self-hosted or served via Together, Groq, Replicate, and Bedrock.",
    aliases: ["llama", "meta", "meta llama"],
    sortOrder: 7,
  },
  {
    slug: "cohere",
    name: "Cohere",
    description: "Enterprise-focused LLM provider behind the Command and Embed model families.",
    aliases: ["cohere"],
    sortOrder: 8,
  },
  {
    slug: "other",
    name: "Other / Niche",
    description: "Specialty providers (Groq, Together, Perplexity, Replicate, Fireworks, etc.) that don't yet have their own rollup page.",
    aliases: ["groq", "together", "together ai", "perplexity", "replicate", "fireworks ai", "openrouter", "openai-compatible"],
    sortOrder: 9,
  },
  {
    slug: "unknown",
    name: "Unknown / Self-hosted",
    description: "AIHackr couldn't fingerprint a commercial provider. The product is likely running self-hosted models or hides its inference layer behind a private gateway.",
    aliases: ["unknown", "self-hosted"],
    sortOrder: 10,
  },
];

/**
 * Idempotent seed of tracked_companies + provider_rollups. Runs on every
 * boot — uses ON CONFLICT (slug) DO NOTHING so existing rows are preserved.
 * Returns the number of newly inserted rows for each table.
 */
export async function runSeed(): Promise<{ companies: number; providers: number }> {
  const companyRows = SEED_COMPANIES.map((c) => ({
    slug: c.slug,
    name: c.name,
    domain: c.domain,
    url: c.url,
    category: c.category,
    ycBatch: c.ycBatch || null,
    description: c.description,
    logoUrl: c.logoUrl || null,
    status: "live",
  }));

  const insertedCompanies = await db
    .insert(trackedCompanies)
    .values(companyRows)
    .onConflictDoNothing({ target: trackedCompanies.slug })
    .returning({ id: trackedCompanies.id });

  const providerRows = SEED_PROVIDERS.map((p) => ({
    slug: p.slug,
    name: p.name,
    description: p.description,
    aliases: p.aliases,
    sortOrder: p.sortOrder,
  }));

  const insertedProviders = await db
    .insert(providerRollups)
    .values(providerRows)
    .onConflictDoNothing({ target: providerRollups.slug })
    .returning({ id: providerRollups.id });

  return {
    companies: insertedCompanies.length,
    providers: insertedProviders.length,
  };
}
