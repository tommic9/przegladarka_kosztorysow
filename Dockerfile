# Stage 1: Build
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache libstdc++
WORKDIR /app

ENV NODE_ENV=production

# Copy built app and all dependencies (including compiled native modules)
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/node_modules ./node_modules

RUN mkdir -p data uploads

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
VOLUME ["/app/data", "/app/uploads"]

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["npm", "start"]
