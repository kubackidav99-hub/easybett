FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production COOKIE_SECURE=1 AUTOSCAN=1
EXPOSE 3000
CMD ["node", "server.js"]
