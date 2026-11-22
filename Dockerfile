# One image for both processes: `node index.js` (API) or `node worker.js` (queue consumers)
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .

# utils/logger.js writes logs/*.log when not on Vercel
RUN mkdir -p logs && chown node:node logs
USER node
EXPOSE 5000
CMD ["node", "index.js"]
