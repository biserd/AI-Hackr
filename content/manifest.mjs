export const published='2026-11-09';
export const docs=[
  ['quickstart','Quickstart','Scrape your first public webpage with AIHackr. Sign in, create an API key and call the web scraping API with JavaScript, Python or cURL.','Start here'],
  ['authentication','Accounts and API keys','Learn how AIHackr email sign-in, private workspaces and revocable API keys work. Keep credentials on your server and inspect trial usage.','Start here'],
  ['scrape','Scrape API','Convert a public webpage to Markdown, HTML or links with the AIHackr Scrape API. Includes request examples, response fields and browser options.','API reference'],
  ['map','Map API','Discover same-origin links on a public webpage with the AIHackr Map API. Learn page-level discovery limits and when to use a recursive crawl.','API reference'],
  ['crawl','Crawl API','Start a bounded website crawl, poll status, paginate retained results and cancel jobs with the AIHackr Crawl API. Includes practical request examples.','API reference'],
  ['extract','Extract API','Extract structured JSON from a public webpage with an AIHackr prompt or JSON schema. Includes a working request shape and validation guidance.','API reference'],
  ['mcp','MCP integration','Connect AIHackr to ChatGPT with OAuth or use a customer API key in a compatible Streamable HTTP client. Explore the browser and crawl tools.','Integrations'],
  ['limits','Usage, limits and retention','Understand the AIHackr 1,200 free credits each month, crawl reservations, request limits, seven-day result retention and current service availability.','Operations'],
  ['errors','Errors and troubleshooting','Resolve AIHackr API authentication, URL, robots, rate-limit and crawl errors. Use error codes to decide when to correct a request or retry.','Operations'],
  ['migration','Firecrawl API migration','Evaluate the documented Firecrawl-shaped REST subset in AIHackr. Compare supported routes, MCP tools and differences before changing your integration.','Integrations'],
].map(([slug,title,description,category])=>({path:'/docs/'+slug,title,description,category,kind:'docs'}));
export const posts=[
  ['website-to-markdown-api','How to turn a website into Markdown with an API','A practical guide to scraping public webpages as Markdown, preserving source URLs and preparing useful text for AI applications.','Web scraping','7 min'],
  ['scrape-vs-crawl-vs-map','Scrape vs. crawl vs. map: choose the right request','Understand when to scrape one page, map its links or crawl a bounded section of a website, with AIHackr examples and usage considerations.','Engineering','6 min'],
  ['web-data-for-rag','Build a source-aware web data pipeline for RAG','Plan a web-to-RAG workflow with bounded crawling, retained source metadata, chunking, validation and a refresh strategy.','AI workflows','8 min'],
  ['structured-data-extraction','Extract JSON from webpages without losing context','Use prompts and JSON schemas to turn public page content into structured data. Learn how to validate missing values and retain source context.','Tutorial','7 min'],
].map(([slug,title,description,category,readingTime])=>({path:'/blog/'+slug,title,description,category,readingTime,kind:'post',date:published}));
export const landings=[
  ['/use-cases/rag','Web data for RAG pipelines','Collect public web content as Markdown for retrieval-augmented generation. Use bounded AIHackr crawls, source URLs and your own ingestion pipeline.'],
  ['/use-cases/ai-agents','Web scraping tools for AI agents','Give agents access to public webpages with AIHackr REST APIs and MCP tools. Read page content, discover links and run bounded website crawls.'],
  ['/use-cases/data-extraction','Structured web data extraction','Turn public webpages into structured JSON with AIHackr. Use a prompt or schema, validate the output and keep source context in your workflow.'],
  ['/plans','Monthly plans and application credits','Compare AIHackr monthly plans: Starter $7, Builder $15 and Scale $29. Start with 1,200 free credits each month, then manage subscriptions and usage in your dashboard.'],
].map(([path,title,description])=>({path,title,description,kind:'landing'}));
export const hubs=[
  {path:'/docs',title:'AIHackr documentation',description:'Learn the AIHackr web scraping API: quickstart guides, REST reference, MCP integration, authentication, crawl limits and troubleshooting.',kind:'docsHub'},
  {path:'/blog',title:'Web scraping and AI data guides',description:'Practical AIHackr guides to website-to-Markdown APIs, structured extraction, bounded crawling and preparing source-aware web content for AI.',kind:'blogHub'},
  {path:'/use-cases',title:'Build with public web data',description:'Explore AIHackr workflows for RAG, AI agents and structured data extraction. Connect public webpages to your applications through REST and MCP.',kind:'useCasesHub'},
];
export const policies=[
  ['/privacy','Privacy policy','Learn how AIHackr handles account information, public-page requests, retained results, billing references, cookies and privacy requests.'],
  ['/terms','Terms of service','Read AIHackr service terms covering accounts, application credits, monthly subscriptions, cancellation, acceptable use and support.'],
  ['/refunds','Cancellation and refunds','Understand AIHackr subscription cancellation, credit expiry, refund reviews, billing errors and how to contact customer support.'],
  ['/acceptable-use','Acceptable use policy','Review AIHackr rules for public web retrieval, permitted sources, account security, agent integrations and responsible service use.'],
  ['/cookies','Cookie policy','Learn about AIHackr essential authentication cookies, browser features, hosted payment pages and the current optional tracking setup.'],
  ['/support','Customer support','Get help with AIHackr jobs, credits, subscriptions, invoices, account access and privacy requests through the existing operator support contact.'],
].map(([path,title,description])=>({path,title,description,kind:'policy'}));
export const pages=[...hubs,...docs,...posts,...landings,...policies];
