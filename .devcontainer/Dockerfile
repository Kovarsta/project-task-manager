FROM node:22-alpine

RUN apk add --no-cache git openssh tini

RUN npm install -g pnpm

ENTRYPOINT ["/sbin/tini", "--"]

# Set up PNPM home inside the container's user home directory (isolated from host)
ENV PNPM_HOME="/home/node/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /workspace

# Fix permissions for the workspace
RUN chown -R node:node /workspace

USER node

# Tell PNPM to keep its virtual store local to the container's node_modules
RUN pnpm config set virtual-store-dir /workspace/node_modules/.pnpm