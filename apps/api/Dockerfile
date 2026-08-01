# Build im Kontext des Monorepo-Wurzelverzeichnisses:
#   docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

RUN npm run build --workspace @garagentor/shared \
  && npm run db:generate --workspace @garagentor/api \
  && npm run build --workspace @garagentor/api

# Die Builder-Stufe behält ihre Entwicklungsabhängigkeiten und dient deshalb
# im Betrieb als Werkzeugkasten: sie bringt das Prisma-CLI für Migrationen
# und ts-node für das Anlegen des ersten Administrators mit.
WORKDIR /app/apps/api

FROM builder AS pruner
WORKDIR /app
# Entwicklungsabhängigkeiten für das Laufzeit-Image entfernen.
RUN npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S app && adduser -S app -G app

COPY --from=pruner /app/node_modules ./node_modules
COPY --from=pruner /app/package.json ./package.json
COPY --from=pruner /app/packages/shared/dist ./packages/shared/dist
COPY --from=pruner /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=pruner /app/apps/api/dist ./apps/api/dist
COPY --from=pruner /app/apps/api/package.json ./apps/api/package.json
COPY --from=pruner /app/apps/api/prisma ./apps/api/prisma

RUN mkdir -p /app/uploads && chown -R app:app /app/uploads
USER app

EXPOSE 4000
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
