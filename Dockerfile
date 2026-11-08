# The backend runtime is separate from the Cloudflare frontend Worker.
FROM node:24-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY native/package.json native/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY native/src ./src
COPY native/public ./public
COPY native/LICENSE ./LICENSE
USER node
EXPOSE 8080
CMD ["node", "src/start.mjs"]
