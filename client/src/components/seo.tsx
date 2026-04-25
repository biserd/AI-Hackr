interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "article";
  publishedTime?: string;
  keywords?: string;
}

const DEFAULT_DESCRIPTION =
  "AIHackr is the AI provider intelligence tool for SaaS — fingerprint the AI provider, model family, and gateway behind any SaaS, with confidence levels and the evidence trail.";

const DEFAULT_KEYWORDS =
  "AI provider detector, LLM detection, OpenAI detection, Anthropic detection, AI stack intelligence, SaaS AI fingerprinting, competitor AI analysis";

const BRAND_TAGLINE = "AI provider intelligence for SaaS";

export function SEO({ 
  title, 
  description = DEFAULT_DESCRIPTION,
  image = "https://aihackr.com/opengraph.jpg",
  url,
  type = "website",
  publishedTime,
  keywords = DEFAULT_KEYWORDS,
}: SEOProps) {
  const fullTitle = title.includes("AIHackr")
    ? title
    : `${title} | AIHackr — ${BRAND_TAGLINE}`;
  
  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="AIHackr" />
      {url && <meta property="og:url" content={url} />}
      
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      
      {type === "article" && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      
      {url && <link rel="canonical" href={url} />}
    </>
  );
}
