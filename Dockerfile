FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache curl

COPY package.json ./
COPY src ./src
COPY public ./public

EXPOSE 3000
CMD ["node", "src/server.js"]
