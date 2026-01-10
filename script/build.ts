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

  console.log("pre-rendering blog pages...");
  await prerenderBlog();
}

async function prerenderBlog() {
  const BLOG_POSTS = [
    {
      slug: 'what-technologies-the-successful-projects-at-hacker-news-are-using',
      title: 'What Technologies the Successful Projects at Hacker News Are Using',
      description: 'Tech stack analysis of Show HN products. See which frameworks, hosting, payments, auth, and AI providers power top Hacker News launches.',
      publishedTime: '2026-01-01',
      keywords: 'Show HN, Hacker News, tech stack, Next.js, Vercel, Stripe, OpenAI, AI startups'
    }
  ];

  const BLOG_INDEX = {
    title: 'Blog - Tech Stack Insights & Research',
    description: 'Deep dives into tech stack trends, AI adoption patterns, and what\'s powering successful SaaS products. Analysis from AIHackr.',
    keywords: 'tech stack, AI providers, SaaS tools, framework analysis, hosting trends'
  };

  const distDir = path.resolve(process.cwd(), 'dist/public');
  
  const indexHtml = await readFile(path.join(distDir, 'index.html'), 'utf-8');
  const scriptMatch = indexHtml.match(/<script[^>]*type="module"[^>]*src="([^"]+)"[^>]*>/);
  const cssMatch = indexHtml.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/);
  
  const scriptSrc = scriptMatch ? scriptMatch[1] : '/assets/index.js';
  const cssSrc = cssMatch ? cssMatch[1] : '';

  const generateHTML = (title: string, description: string, canonicalUrl: string, keywords: string, type: string = 'website', publishedTime?: string) => `<!DOCTYPE html>
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
  ${publishedTime ? `<meta property="article:published_time" content="${publishedTime}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="https://aihackr.com/opengraph.jpg">
  ${cssSrc ? `<link rel="stylesheet" href="${cssSrc}">` : ''}
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
  </noscript>
</body>
</html>`;

  const blogDir = path.join(distDir, 'blog');
  
  await mkdir(blogDir, { recursive: true });

  await writeFile(
    path.join(blogDir, 'index.html'),
    generateHTML(BLOG_INDEX.title, BLOG_INDEX.description, 'https://aihackr.com/blog', BLOG_INDEX.keywords)
  );
  console.log('Generated: /blog/index.html');

  for (const post of BLOG_POSTS) {
    const postDir = path.join(blogDir, post.slug);
    await mkdir(postDir, { recursive: true });
    await writeFile(
      path.join(postDir, 'index.html'),
      generateHTML(post.title, post.description, `https://aihackr.com/blog/${post.slug}`, post.keywords, 'article', post.publishedTime)
    );
    console.log(`Generated: /blog/${post.slug}/index.html`);
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
