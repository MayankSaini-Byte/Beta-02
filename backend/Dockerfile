FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src
COPY scripts ./scripts

# frontend build can be mounted at /app/public (see docker-compose.yml)
ENV FRONTEND_DIST=/app/public
ENV NODE_ENV=production

EXPOSE 5000
CMD ["node", "src/server.js"]
