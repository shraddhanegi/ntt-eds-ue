FROM node:20-bookworm-slim

# Puppeteer / Chrome dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV INGEST_UI_PORT=3002
ENV EDS_PROJECT_ROOT=/workspace

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3002

VOLUME ["/workspace"]

CMD ["node", "api-server.mjs"]
