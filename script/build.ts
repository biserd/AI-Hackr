import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, mkdir, writeFile } from "fs/promises";
import path from "path";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  console.log("pre-rendering SEO pages...");
  await prerenderAll();
}

// Tracked companies + provider rollups + blog posts to prerender SEO HTML
// stubs for. We hard-code these here (rather than connecting to Postgres at
// build time) so builds work in any environment. The seed file is the source
// of truth at runtime; this list mirrors it.
const TRACKED_COMPANY_SLUGS = [
  "notion", "linear", "stripe", "intercom", "cursor", "replit", "perplexity",
  "figma", "github", "vercel", "netlify", "supabase", "neon", "planetscale",
  "clerk", "auth0", "datadog", "sentry", "loom", "framer", "webflow", "shopify",
  "airtable", "asana", "trello", "monday", "clickup", "slack", "discord", "zoom",
  "calendly", "typeform", "mailchimp", "hubspot", "salesforce", "zendesk",
  "freshdesk", "miro", "pitch", "raycast", "arc", "linear-app", "height",
  "amplitude", "mixpanel", "posthog", "segment", "fivetran", "dbt", "snowflake",
];

const PROVIDER_SLUGS = [
  "openai", "anthropic", "google-gemini", "azure-openai", "aws-bedrock",
  "mistral", "meta-llama", "cohere", "other", "unknown",
];

const BLOG_POSTS: Array<{
  slug: string;
  title: string;
  description: string;
  publishedTime: string;
  keywords: string;
}> = [
  {
    slug: "what-technologies-the-successful-projects-at-hacker-news-are-using",
    title: "What Technologies the Successful Projects at Hacker News Are Using",
    description: "Tech stack analysis of Show HN products. See which frameworks, hosting, payments, auth, and AI providers power top Hacker News launches.",
    publishedTime: "2026-01-01",
    keywords: "Show HN, Hacker News, tech stack, Next.js, Vercel, Stripe, OpenAI, AI startups",
  },
  {
    slug: "openai-vs-anthropic-which-saas-companies-use-which",
    title: "OpenAI vs Anthropic — Which SaaS Companies Use Which",
    description: "A side-by-side breakdown of which SaaS products run on OpenAI vs Anthropic, with confidence levels and the reasoning behind each detection.",
    publishedTime: "2026-02-01",
    keywords: "OpenAI vs Anthropic, Claude vs GPT-4, SaaS AI provider, LLM market share",
  },
  {
    slug: "the-state-of-ai-in-saas-2026",
    title: "The State of AI in SaaS — 2026",
    description: "Annual report on which AI providers, model families, and gateways power the modern SaaS stack — based on continuous fingerprinting of 50+ products.",
    publishedTime: "2026-04-01",
    keywords: "state of AI, SaaS AI 2026, LLM adoption, AI gateway, OpenAI Anthropic Bedrock",
  },
  {
    slug: "azure-openai-adoption-in-enterprise-saas",
    title: "Azure OpenAI Adoption in Enterprise SaaS",
    description: "Which regulated-industry SaaS products run on Azure OpenAI and why — fingerprinted directly from their production network behavior.",
    publishedTime: "2026-02-15",
    keywords: "Azure OpenAI, enterprise AI, regulated SaaS, GPT-4 enterprise",
  },
  {
    slug: "ai-gateways-explained-cloudflare-portkey-helicone",
    title: "AI Gateways Explained — Cloudflare AI Gateway, Portkey, Helicone",
    description: "What an AI gateway is, why SaaS teams adopt them, and how to detect Cloudflare AI Gateway, Portkey, or Helicone in any production app.",
    publishedTime: "2026-03-01",
    keywords: "AI gateway, Cloudflare AI Gateway, Portkey, Helicone, LLM proxy",
  },
  {
    slug: "claude-vs-gpt-4-real-world-saas-deployments",
    title: "Claude vs GPT-4 — Real-World SaaS Deployments",
    description: "A real-world look at which SaaS products ship Claude vs GPT-4 in production, organized by category and use case.",
    publishedTime: "2026-03-10",
    keywords: "Claude vs GPT-4, Anthropic vs OpenAI, SaaS LLM deployments",
  },
  {
    slug: "self-hosted-llms-which-saas-products-run-their-own-models",
    title: "Self-Hosted LLMs — Which SaaS Products Run Their Own Models",
    description: "Self-hosted inference is back. We mapped which SaaS products are running their own Llama, Mistral, or fine-tuned models in production.",
    publishedTime: "2026-03-20",
    keywords: "self-hosted LLM, Llama, Mistral, fine-tuned models, on-prem AI",
  },
  {
    slug: "aws-bedrock-customers-the-complete-list",
    title: "AWS Bedrock Customers — The Complete List",
    description: "Every SaaS we've fingerprinted running on AWS Bedrock, with the inferred model family and supporting evidence trail.",
    publishedTime: "2026-04-05",
    keywords: "AWS Bedrock customers, Bedrock SaaS, Anthropic on AWS, Claude on AWS",
  },
  {
    slug: "every-yc-batch-and-which-ai-they-use",
    title: "Every YC Batch and Which AI They Use",
    description: "A continuously updated tour of YC-backed SaaS companies and the AI providers powering them, batch by batch.",
    publishedTime: "2026-04-10",
    keywords: "YC startups AI, Y Combinator AI providers, YC W26, YC S25, AI in startups",
  },
  {
    slug: "how-to-tell-which-llm-a-website-is-using",
    title: "How to Tell Which LLM a Website Is Using",
    description: "A practical, step-by-step guide to fingerprinting the AI provider behind any website — the techniques AIHackr uses internally.",
    publishedTime: "2026-04-15",
    keywords: "fingerprinting LLM, detect AI provider, network analysis SaaS, OpenAI fingerprint",
  },
  {
    slug: "what-changed-this-week-in-saas-ai-stacks",
    title: "What Changed This Week in SaaS AI Stacks",
    description: "Our weekly roundup of provider switches, gateway adoptions, and stack changes detected across the SaaS AI landscape.",
    publishedTime: "2026-04-20",
    keywords: "SaaS AI changes, weekly LLM news, provider switches, AI migration",
  },
  {
    slug: "the-complete-guide-to-fingerprinting-ai-providers",
    title: "The Complete Guide to Fingerprinting AI Providers",
    description: "Everything we know about identifying the AI provider behind any production app — signals, evidence weights, and confidence calibration.",
    publishedTime: "2026-04-25",
    keywords: "AI fingerprinting, LLM detection, AI provider detection, OpenAI Anthropic detection",
  },
];

async function prerenderAll() {
  const BLOG_INDEX = {
    title: "Blog - Tech Stack Insights & Research",
    description: "Deep dives into tech stack trends, AI adoption patterns, and what's powering successful SaaS products. Analysis from AIHackr.",
    keywords: "tech stack, AI providers, SaaS tools, framework analysis, hosting trends",
  };

  const distDir = path.resolve(process.cwd(), "dist/public");

  const indexHtml = await readFile(path.join(distDir, "index.html"), "utf-8");
  const scriptMatch = indexHtml.match(/<script[^>]*type="module"[^>]*src="([^"]+)"[^>]*>/);
  const cssMatch = indexHtml.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/);

  const scriptSrc = scriptMatch ? scriptMatch[1] : "/assets/index.js";
  const cssSrc = cssMatch ? cssMatch[1] : "";

  const generateHTML = (
    title: string,
    description: string,
    canonicalUrl: string,
    keywords: string,
    type = "website",
    publishedTime?: string,
    bodyContent = "",
  ) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | AIHackr</title>
  <meta name="description" content="${description}">
  <meta name="keywords" content="${keywords}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="${type}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="https://aihackr.com/opengraph.jpg">
  ${publishedTime ? `<meta property="article:published_time" content="${publishedTime}">` : ""}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="https://aihackr.com/opengraph.jpg">
  ${cssSrc ? `<link rel="stylesheet" href="${cssSrc}">` : ""}
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${scriptSrc}"></script>
  <noscript>
    <h1>${title}</h1>
    <p>${description}</p>
    ${bodyContent}
  </noscript>
</body>
</html>`;

  // /stack index
  const stackDir = path.join(distDir, "stack");
  await mkdir(stackDir, { recursive: true });
  await writeFile(
    path.join(stackDir, "index.html"),
    generateHTML(
      "The AI Stack of 50 Top SaaS Companies",
      "See which AI provider, model family, and gateway power 50+ leading SaaS products. Updated weekly with confidence levels and evidence trail.",
      "https://aihackr.com/stack",
      "SaaS AI stack, AI provider directory, OpenAI customers, Anthropic customers",
    ),
  );
  console.log("Generated: /stack/index.html");

  // /stack/:slug — one file per company
  for (const slug of TRACKED_COMPANY_SLUGS) {
    const dir = path.join(stackDir, slug);
    await mkdir(dir, { recursive: true });
    const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    await writeFile(
      path.join(dir, "index.html"),
      generateHTML(
        `${title} AI Stack`,
        `Which AI provider does ${title} use? AIHackr fingerprints the LLM, model family, gateway, and supporting stack of ${title} continuously.`,
        `https://aihackr.com/stack/${slug}`,
        `${title} AI provider, what AI does ${title} use, ${title} tech stack, ${title} LLM`,
        "article",
      ),
    );
  }
  console.log(`Generated: ${TRACKED_COMPANY_SLUGS.length} stack/:slug pages`);

  // /leaderboard
  const lbDir = path.join(distDir, "leaderboard");
  await mkdir(lbDir, { recursive: true });
  await writeFile(
    path.join(lbDir, "index.html"),
    generateHTML(
      "AI Leaderboard — Which LLMs Power SaaS",
      "Live ranking of which AI provider every major SaaS product uses. Filter by provider, category, confidence. Updated weekly with stack-change diffs.",
      "https://aihackr.com/leaderboard",
      "AI leaderboard, LLM market share SaaS, OpenAI vs Anthropic SaaS, which AI does SaaS use",
    ),
  );
  console.log("Generated: /leaderboard/index.html");

  // /provider/:slug — one file per provider rollup
  const providerDir = path.join(distDir, "provider");
  await mkdir(providerDir, { recursive: true });
  for (const slug of PROVIDER_SLUGS) {
    const dir = path.join(providerDir, slug);
    await mkdir(dir, { recursive: true });
    const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    await writeFile(
      path.join(dir, "index.html"),
      generateHTML(
        `SaaS using ${title}`,
        `Every SaaS product AIHackr has fingerprinted as running on ${title} — with confidence levels and evidence trail.`,
        `https://aihackr.com/provider/${slug}`,
        `${title} customers, SaaS using ${title}, ${title} AI provider, ${title} adoption`,
      ),
    );
  }
  console.log(`Generated: ${PROVIDER_SLUGS.length} provider/:slug pages`);

  // /blog index + every post
  const blogDir = path.join(distDir, "blog");
  await mkdir(blogDir, { recursive: true });
  await writeFile(
    path.join(blogDir, "index.html"),
    generateHTML(BLOG_INDEX.title, BLOG_INDEX.description, "https://aihackr.com/blog", BLOG_INDEX.keywords),
  );
  console.log("Generated: /blog/index.html");

  for (const post of BLOG_POSTS) {
    const postDir = path.join(blogDir, post.slug);
    await mkdir(postDir, { recursive: true });
    await writeFile(
      path.join(postDir, "index.html"),
      generateHTML(post.title, post.description, `https://aihackr.com/blog/${post.slug}`, post.keywords, "article", post.publishedTime),
    );
  }
  console.log(`Generated: ${BLOG_POSTS.length} blog post pages`);
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
