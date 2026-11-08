FROM node:24-bookworm-slim AS build

ENV PORT=8080
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build && npm prune --omit=dev && npm --prefix services/web-data prune --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=8080 PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app

# Keep build caches and removed development dependency layers out of production.
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/script/start-production.mjs ./script/start-production.mjs
COPY --from=build /app/services/web-data/package.json ./services/web-data/package.json
COPY --from=build /app/services/web-data/node_modules ./services/web-data/node_modules
COPY --from=build /app/services/web-data/dist ./services/web-data/dist
COPY --from=build /app/services/web-data/migrations ./services/web-data/migrations

# The existing scanner uses Chromium only. Install the locked package's browser
# and dependencies rather than shipping Firefox, WebKit and development tools.
RUN node node_modules/playwright/cli.js install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/* /root/.cache

# Fail the actual Linux image build if the scanner's browser cannot run JS.
RUN node --input-type=module -e 'import { chromium } from "playwright"; const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] }); try { const page = await browser.newPage(); await page.setContent("<script>document.title = String(6 * 7)</script>"); if (await page.title() !== "42") throw new Error("Chromium JavaScript smoke failed"); console.log("Production Chromium JavaScript smoke passed"); } finally { await browser.close(); }'

EXPOSE 8080
CMD ["node", "script/start-production.mjs"]
