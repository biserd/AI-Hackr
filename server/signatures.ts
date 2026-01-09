export interface EvidenceRule {
  type: "html" | "script_src" | "header" | "cookie" | "meta" | "dns" | "network" | "script_body";
  pattern: string;
  key?: string;
  weight: number;
}

export interface TechSignature {
  id: string;
  name: string;
  category: "framework" | "hosting" | "payments" | "auth" | "analytics" | "support" | "ai" | "cdn" | "cms";
  rules: EvidenceRule[];
  thresholds: { high: number; medium: number };
}

export interface AISignature {
  id: string;
  name: string;
  rules: EvidenceRule[];
  thresholds: { high: number; medium: number };
}

export const SIGNATURE_DB: TechSignature[] = [
  // Frameworks
  {
    id: "nextjs",
    name: "Next.js",
    category: "framework",
    rules: [
      { type: "html", pattern: "__NEXT_DATA__", weight: 0.7 },
      { type: "script_src", pattern: "/_next/static/", weight: 0.6 },
      { type: "header", key: "x-powered-by", pattern: "Next\\.js", weight: 0.6 },
      { type: "script_src", pattern: "/_next/", weight: 0.4 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "nuxt",
    name: "Nuxt",
    category: "framework",
    rules: [
      { type: "html", pattern: "__NUXT__", weight: 0.7 },
      { type: "html", pattern: "data-n-head", weight: 0.5 },
      { type: "script_src", pattern: "/_nuxt/", weight: 0.6 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "react",
    name: "React",
    category: "framework",
    rules: [
      { type: "html", pattern: "data-reactroot", weight: 0.6 },
      { type: "html", pattern: "__REACT_DEVTOOLS_GLOBAL_HOOK__", weight: 0.5 },
      { type: "script_src", pattern: "react\\.production\\.min\\.js", weight: 0.7 },
      { type: "script_src", pattern: "react-dom", weight: 0.5 },
      { type: "html", pattern: "_reactListening", weight: 0.4 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "vue",
    name: "Vue.js",
    category: "framework",
    rules: [
      { type: "html", pattern: "data-v-", weight: 0.6 },
      { type: "script_src", pattern: "vue\\.js", weight: 0.7 },
      { type: "script_src", pattern: "vue\\.min\\.js", weight: 0.7 },
      { type: "html", pattern: "__VUE__", weight: 0.5 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "angular",
    name: "Angular",
    category: "framework",
    rules: [
      { type: "html", pattern: "ng-version", weight: 0.7 },
      { type: "script_src", pattern: "angular\\.js", weight: 0.6 },
      { type: "html", pattern: "ng-app", weight: 0.5 },
      { type: "script_src", pattern: "main\\.[a-f0-9]+\\.js", weight: 0.3 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "svelte",
    name: "Svelte",
    category: "framework",
    rules: [
      { type: "html", pattern: "svelte", weight: 0.5 },
      { type: "script_src", pattern: "svelte", weight: 0.6 },
      { type: "html", pattern: "__svelte", weight: 0.7 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "remix",
    name: "Remix",
    category: "framework",
    rules: [
      { type: "html", pattern: "__remixContext", weight: 0.8 },
      { type: "script_src", pattern: "/build/", weight: 0.3 },
      { type: "html", pattern: "remix", weight: 0.4 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "astro",
    name: "Astro",
    category: "framework",
    rules: [
      { type: "html", pattern: "astro-island", weight: 0.8 },
      { type: "html", pattern: "astro-slot", weight: 0.7 },
      { type: "script_src", pattern: "astro", weight: 0.5 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },

  // Hosting
  {
    id: "vercel",
    name: "Vercel",
    category: "hosting",
    rules: [
      { type: "header", key: "x-vercel-id", pattern: ".*", weight: 0.9 },
      { type: "header", key: "server", pattern: "Vercel", weight: 0.8 },
      { type: "dns", pattern: "vercel-dns\\.com", weight: 0.7 },
      { type: "script_src", pattern: "/_vercel/insights/", weight: 0.6 },
      { type: "header", key: "x-vercel-cache", pattern: ".*", weight: 0.5 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "netlify",
    name: "Netlify",
    category: "hosting",
    rules: [
      { type: "header", key: "server", pattern: "Netlify", weight: 0.9 },
      { type: "header", key: "x-nf-request-id", pattern: ".*", weight: 0.8 },
      { type: "dns", pattern: "netlify\\.app", weight: 0.7 },
      { type: "header", key: "x-nf-", pattern: ".*", weight: 0.5 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    category: "cdn",
    rules: [
      { type: "header", key: "cf-ray", pattern: ".*", weight: 0.9 },
      { type: "header", key: "server", pattern: "cloudflare", weight: 0.8 },
      { type: "header", key: "cf-cache-status", pattern: ".*", weight: 0.6 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "aws",
    name: "AWS",
    category: "hosting",
    rules: [
      { type: "header", key: "x-amz-", pattern: ".*", weight: 0.7 },
      { type: "header", key: "server", pattern: "AmazonS3", weight: 0.8 },
      { type: "dns", pattern: "amazonaws\\.com", weight: 0.7 },
      { type: "dns", pattern: "cloudfront\\.net", weight: 0.6 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "heroku",
    name: "Heroku",
    category: "hosting",
    rules: [
      { type: "header", key: "via", pattern: "heroku", weight: 0.8 },
      { type: "dns", pattern: "herokuapp\\.com", weight: 0.9 },
      { type: "header", key: "server", pattern: "heroku", weight: 0.7 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "railway",
    name: "Railway",
    category: "hosting",
    rules: [
      { type: "dns", pattern: "railway\\.app", weight: 0.9 },
      { type: "header", key: "server", pattern: "railway", weight: 0.7 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "render",
    name: "Render",
    category: "hosting",
    rules: [
      { type: "dns", pattern: "onrender\\.com", weight: 0.9 },
      { type: "header", key: "server", pattern: "render", weight: 0.7 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "replit",
    name: "Replit",
    category: "hosting",
    rules: [
      { type: "dns", pattern: "replit\\.dev", weight: 0.9 },
      { type: "dns", pattern: "repl\\.co", weight: 0.9 },
      { type: "header", key: "x-replit-", pattern: ".*", weight: 0.7 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },

  // Payments
  {
    id: "stripe",
    name: "Stripe",
    category: "payments",
    rules: [
      { type: "script_src", pattern: "js\\.stripe\\.com", weight: 0.9 },
      { type: "html", pattern: "checkout\\.stripe\\.com", weight: 0.8 },
      { type: "script_src", pattern: "stripe\\.com/v3", weight: 0.9 },
      { type: "html", pattern: "stripe-js", weight: 0.6 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "paypal",
    name: "PayPal",
    category: "payments",
    rules: [
      { type: "script_src", pattern: "paypal\\.com/sdk", weight: 0.9 },
      { type: "html", pattern: "paypal", weight: 0.4 },
      { type: "script_src", pattern: "paypalobjects\\.com", weight: 0.7 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "paddle",
    name: "Paddle",
    category: "payments",
    rules: [
      { type: "script_src", pattern: "paddle\\.com", weight: 0.9 },
      { type: "html", pattern: "paddle", weight: 0.4 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "lemon_squeezy",
    name: "Lemon Squeezy",
    category: "payments",
    rules: [
      { type: "script_src", pattern: "lemonsqueezy\\.com", weight: 0.9 },
      { type: "html", pattern: "lemonsqueezy", weight: 0.5 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },

  // Auth
  {
    id: "clerk",
    name: "Clerk",
    category: "auth",
    rules: [
      { type: "script_src", pattern: "clerk\\.com", weight: 0.9 },
      { type: "html", pattern: "__clerk", weight: 0.7 },
      { type: "script_src", pattern: "@clerk/clerk-js", weight: 0.8 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "auth0",
    name: "Auth0",
    category: "auth",
    rules: [
      { type: "script_src", pattern: "cdn\\.auth0\\.com", weight: 0.9 },
      { type: "html", pattern: "auth0", weight: 0.4 },
      { type: "script_src", pattern: "auth0-js", weight: 0.7 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "supabase_auth",
    name: "Supabase Auth",
    category: "auth",
    rules: [
      { type: "script_src", pattern: "supabase", weight: 0.6 },
      { type: "html", pattern: "supabase\\.co/auth", weight: 0.8 },
      { type: "script_src", pattern: "@supabase/supabase-js", weight: 0.7 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "firebase_auth",
    name: "Firebase Auth",
    category: "auth",
    rules: [
      { type: "script_src", pattern: "firebase.*auth", weight: 0.8 },
      { type: "html", pattern: "firebaseauth", weight: 0.6 },
      { type: "script_src", pattern: "firebaseapp\\.com", weight: 0.5 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "okta",
    name: "Okta",
    category: "auth",
    rules: [
      { type: "script_src", pattern: "okta\\.com", weight: 0.9 },
      { type: "html", pattern: "okta", weight: 0.4 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "nextauth",
    name: "NextAuth.js",
    category: "auth",
    rules: [
      { type: "html", pattern: "next-auth", weight: 0.7 },
      { type: "cookie", pattern: "next-auth\\.session-token", weight: 0.8 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },

  // Analytics
  {
    id: "google_analytics",
    name: "Google Analytics (GA4)",
    category: "analytics",
    rules: [
      { type: "script_src", pattern: "googletagmanager\\.com/gtag", weight: 0.9 },
      { type: "html", pattern: "gtag\\('config'", weight: 0.7 },
      { type: "script_src", pattern: "google-analytics\\.com", weight: 0.8 },
      { type: "html", pattern: "G-[A-Z0-9]+", weight: 0.5 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "posthog",
    name: "PostHog",
    category: "analytics",
    rules: [
      { type: "script_src", pattern: "posthog\\.com", weight: 0.9 },
      { type: "html", pattern: "posthog", weight: 0.5 },
      { type: "script_src", pattern: "array\\.js", weight: 0.6 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "mixpanel",
    name: "Mixpanel",
    category: "analytics",
    rules: [
      { type: "script_src", pattern: "mixpanel\\.com", weight: 0.9 },
      { type: "html", pattern: "mixpanel", weight: 0.5 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "segment",
    name: "Segment",
    category: "analytics",
    rules: [
      { type: "script_src", pattern: "segment\\.com", weight: 0.9 },
      { type: "script_src", pattern: "cdn\\.segment\\.io", weight: 0.8 },
      { type: "html", pattern: "analytics\\.js", weight: 0.4 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "amplitude",
    name: "Amplitude",
    category: "analytics",
    rules: [
      { type: "script_src", pattern: "amplitude\\.com", weight: 0.9 },
      { type: "html", pattern: "amplitude", weight: 0.4 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "heap",
    name: "Heap",
    category: "analytics",
    rules: [
      { type: "script_src", pattern: "heap\\.io", weight: 0.9 },
      { type: "script_src", pattern: "heapanalytics\\.com", weight: 0.9 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "plausible",
    name: "Plausible",
    category: "analytics",
    rules: [
      { type: "script_src", pattern: "plausible\\.io", weight: 0.9 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "hotjar",
    name: "Hotjar",
    category: "analytics",
    rules: [
      { type: "script_src", pattern: "hotjar\\.com", weight: 0.9 },
      { type: "html", pattern: "hjSiteSettings", weight: 0.7 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },

  // Support
  {
    id: "intercom",
    name: "Intercom",
    category: "support",
    rules: [
      { type: "script_src", pattern: "widget\\.intercom\\.io", weight: 0.9 },
      { type: "html", pattern: "Intercom", weight: 0.5 },
      { type: "script_src", pattern: "intercom", weight: 0.6 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "zendesk",
    name: "Zendesk",
    category: "support",
    rules: [
      { type: "script_src", pattern: "zdassets\\.com", weight: 0.9 },
      { type: "html", pattern: "zendesk", weight: 0.5 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "crisp",
    name: "Crisp",
    category: "support",
    rules: [
      { type: "script_src", pattern: "crisp\\.chat", weight: 0.9 },
      { type: "html", pattern: "crisp", weight: 0.4 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "freshdesk",
    name: "Freshdesk",
    category: "support",
    rules: [
      { type: "script_src", pattern: "freshdesk\\.com", weight: 0.9 },
      { type: "html", pattern: "freshdesk", weight: 0.4 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "drift",
    name: "Drift",
    category: "support",
    rules: [
      { type: "script_src", pattern: "drift\\.com", weight: 0.9 },
      { type: "html", pattern: "drift", weight: 0.4 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "hubspot",
    name: "HubSpot",
    category: "support",
    rules: [
      { type: "script_src", pattern: "hubspot\\.com", weight: 0.9 },
      { type: "script_src", pattern: "hs-scripts\\.com", weight: 0.8 },
      { type: "html", pattern: "hubspot", weight: 0.4 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
];

export const AI_SIGNATURES: AISignature[] = [
  {
    id: "openai",
    name: "OpenAI",
    rules: [
      { type: "script_src", pattern: "openai", weight: 0.7 },
      { type: "html", pattern: "api\\.openai\\.com", weight: 0.8 },
      { type: "html", pattern: "openai-api", weight: 0.6 },
      { type: "html", pattern: "gpt-4", weight: 0.5 },
      { type: "html", pattern: "gpt-3\\.5", weight: 0.5 },
      { type: "html", pattern: "chatgpt", weight: 0.4 },
    ],
    thresholds: { high: 0.8, medium: 0.4 },
  },
  {
    id: "azure_openai",
    name: "Azure OpenAI",
    rules: [
      { type: "html", pattern: "openai\\.azure\\.com", weight: 0.9 },
      { type: "html", pattern: "azure.*openai", weight: 0.6 },
      { type: "script_src", pattern: "azure.*openai", weight: 0.7 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "anthropic",
    name: "Anthropic",
    rules: [
      { type: "script_src", pattern: "anthropic", weight: 0.7 },
      { type: "html", pattern: "api\\.anthropic\\.com", weight: 0.8 },
      { type: "html", pattern: "claude-3", weight: 0.6 },
      { type: "html", pattern: "claude-2", weight: 0.5 },
      { type: "html", pattern: "anthropic", weight: 0.4 },
    ],
    thresholds: { high: 0.8, medium: 0.4 },
  },
  {
    id: "google_gemini",
    name: "Google Gemini",
    rules: [
      { type: "script_src", pattern: "generative-ai", weight: 0.8 },
      { type: "html", pattern: "generativelanguage\\.googleapis\\.com", weight: 0.9 },
      { type: "html", pattern: "gemini-pro", weight: 0.7 },
      { type: "html", pattern: "gemini-1\\.5", weight: 0.7 },
      { type: "script_src", pattern: "@google/generative-ai", weight: 0.8 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "cohere",
    name: "Cohere",
    rules: [
      { type: "script_src", pattern: "cohere", weight: 0.7 },
      { type: "html", pattern: "api\\.cohere\\.ai", weight: 0.8 },
      { type: "html", pattern: "cohere\\.ai", weight: 0.5 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "replicate",
    name: "Replicate",
    rules: [
      { type: "html", pattern: "api\\.replicate\\.com", weight: 0.8 },
      { type: "html", pattern: "replicate\\.com", weight: 0.5 },
      { type: "script_src", pattern: "replicate", weight: 0.6 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    rules: [
      { type: "html", pattern: "huggingface\\.co", weight: 0.7 },
      { type: "script_src", pattern: "huggingface", weight: 0.7 },
      { type: "html", pattern: "api-inference\\.huggingface", weight: 0.8 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "mistral",
    name: "Mistral AI",
    rules: [
      { type: "html", pattern: "api\\.mistral\\.ai", weight: 0.8 },
      { type: "html", pattern: "mistral-", weight: 0.6 },
      { type: "script_src", pattern: "mistral", weight: 0.6 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "perplexity",
    name: "Perplexity AI",
    rules: [
      { type: "html", pattern: "api\\.perplexity\\.ai", weight: 0.8 },
      { type: "html", pattern: "perplexity", weight: 0.4 },
      { type: "script_src", pattern: "perplexity", weight: 0.6 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "together_ai",
    name: "Together AI",
    rules: [
      { type: "html", pattern: "api\\.together\\.xyz", weight: 0.8 },
      { type: "html", pattern: "together\\.ai", weight: 0.5 },
      { type: "script_src", pattern: "together", weight: 0.5 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "groq",
    name: "Groq",
    rules: [
      { type: "html", pattern: "api\\.groq\\.com", weight: 0.8 },
      { type: "html", pattern: "groq\\.com", weight: 0.5 },
      { type: "script_src", pattern: "groq", weight: 0.6 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    rules: [
      { type: "html", pattern: "api\\.fireworks\\.ai", weight: 0.8 },
      { type: "html", pattern: "fireworks\\.ai", weight: 0.5 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "vercel_ai_sdk",
    name: "Vercel AI SDK",
    rules: [
      { type: "script_src", pattern: "ai\\.vercel", weight: 0.8 },
      { type: "html", pattern: "useChat", weight: 0.6 },
      { type: "html", pattern: "useCompletion", weight: 0.6 },
      { type: "html", pattern: "@vercel/ai", weight: 0.7 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
  {
    id: "langchain",
    name: "LangChain",
    rules: [
      { type: "html", pattern: "langchain", weight: 0.6 },
      { type: "script_src", pattern: "langchain", weight: 0.7 },
    ],
    thresholds: { high: 0.8, medium: 0.5 },
  },
];
