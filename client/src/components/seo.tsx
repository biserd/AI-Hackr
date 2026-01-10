interface SEOProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: "website" | "article";
  publishedTime?: string;
  keywords?: string;
}

export function SEO({ 
  title, 
  description, 
  image = "https://aihackr.com/opengraph.jpg",
  url,
  type = "website",
  publishedTime,
  keywords
}: SEOProps) {
  const fullTitle = title.includes("AIHackr") ? title : `${title} | AIHackr`;
  
  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={image} />
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
