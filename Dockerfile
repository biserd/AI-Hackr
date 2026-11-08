FROM mcr.microsoft.com/playwright:v1.57.0-noble

ENV PORT=8080
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build && npm prune --omit=dev && npm --prefix services/web-data prune --omit=dev

ENV NODE_ENV=production

EXPOSE 8080
CMD ["node", "script/start-production.mjs"]
