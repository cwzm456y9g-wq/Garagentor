# Build im Kontext des Monorepo-Wurzelverzeichnisses:
#   docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web

# Die Adresse der Schnittstelle landet im Browser-Bundle und muss deshalb
# schon beim Bauen feststehen. Voreingestellt ist ein relativer Pfad: der
# Reverse Proxy liefert Oberfläche und Schnittstelle unter derselben Domain
# aus, damit entfällt CORS.
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build --workspace @garagentor/shared \
  && npm run build --workspace @garagentor/web

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S app && adduser -S app -G app

# Next legt unter standalone/ bereits einen lauffähigen Server mit den
# benötigten Abhängigkeiten ab; statische Dateien kommen daneben.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

USER app
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
