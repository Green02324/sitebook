FROM node:22-slim AS web-build
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ .
RUN npm run build

FROM node:22-slim
WORKDIR /app/api
COPY api/package*.json ./
COPY api/prisma ./prisma
RUN npm ci
COPY api/ .
RUN npm run build
COPY --from=web-build /app/web/dist /app/web/dist

ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "start"]
