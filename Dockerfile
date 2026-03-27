FROM node:20-alpine

WORKDIR /app

# build tools needed for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN DATABASE_PATH=/tmp/build.sqlite npm run build

RUN mkdir -p data

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
