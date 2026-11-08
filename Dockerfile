FROM mcr.microsoft.com/playwright:v1.57.0-noble AS build

ENV PORT=8080
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build && npm prune --omit=dev && npm --prefix services/web-data prune --omit=dev

FROM mcr.microsoft.com/playwright:v1.57.0-noble AS runtime
ENV NODE_ENV=production PORT=8080
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

EXPOSE 8080
CMD ["node", "script/start-production.mjs"]
