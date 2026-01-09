FROM oven/bun:latest

WORKDIR /app/apps/WebCrawl

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3002

COPY apps/WebCrawl/package.json apps/WebCrawl/bun.lock ./
COPY packages/firecrawl-rs /app/packages/firecrawl-rs
RUN bun install

COPY apps/WebCrawl/src ./src
COPY apps/WebCrawl/tsconfig.json ./tsconfig.json

EXPOSE 3002

CMD ["bun", "run", "src/index.ts"]
