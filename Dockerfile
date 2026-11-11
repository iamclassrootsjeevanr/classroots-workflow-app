# Classroots Work – production image (Next.js standalone output)
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build needs a syntactically valid URL only; no database connection is made.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build

# Prisma CLI for "migrate deploy" at start, installed on its own so all of its
# dependencies come along (the standalone output does not include them).
FROM node:22-alpine AS prisma-cli
WORKDIR /cli
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules/prisma/package.json /tmp/prisma-package.json
RUN echo '{"private":true}' > package.json \
 && npm install --no-audit --no-fund "prisma@$(node -p "require('/tmp/prisma-package.json').version")"

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl && addgroup -S app && adduser -S app -G app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=prisma-cli /cli/node_modules /prisma-cli/node_modules
USER app
EXPOSE 3000
# Apply pending migrations, then start.
CMD ["sh", "-c", "node /prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma && node server.js"]
