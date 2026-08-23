FROM mcr.microsoft.com/playwright:v1.57.0-noble

ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

EXPOSE 8080
CMD ["node", "dist/index.cjs"]
