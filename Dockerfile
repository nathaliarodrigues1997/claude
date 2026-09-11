FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src
COPY public ./public

ENV PORT=3000
ENV DATA_DIR=/data
RUN mkdir -p /data && chown -R node:node /data
VOLUME ["/data"]
EXPOSE 3000

USER node

CMD ["node", "src/server.js"]
