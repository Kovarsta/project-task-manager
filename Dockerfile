FROM node:22-alpine AS build
WORKDIR /app
ENV CI=true

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml svelte.config.js tsconfig.json .npmrc ./
COPY prisma/ ./prisma/
RUN pnpm install --ignore-scripts --no-frozen-lockfile && npx prisma generate && \
    mkdir -p /app/prisma-generated && \
    cp -rL /app/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/. /app/prisma-generated/

COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV CI=true
RUN npm install -g pnpm

COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml ./
COPY --from=build /app/.npmrc ./
COPY --from=build /app/prisma ./prisma

RUN pnpm install --prod --ignore-scripts --no-frozen-lockfile
COPY --from=build /app/prisma-generated /app/node_modules/.prisma

EXPOSE 3000
CMD ["node", "build/index.js"]
