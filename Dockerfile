FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci

COPY src ./src
RUN npm run build && npm prune --omit=dev
ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", "src/backend/server.js"]
