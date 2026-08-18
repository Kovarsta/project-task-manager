# Wrapper around rapiz1/rathole that injects RATHOLE_TOKEN into the config at
# container start. The stock rathole image is a bare Debian rootfs with no
# shell; rathole's TOML has no env-var substitution, so we rebuild it on
# debian-slim (glibc, matches the binary) with a shell + envsubst.

FROM rapiz1/rathole:latest AS rathole

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends gettext-base openssl && rm -rf /var/lib/apt/lists/*
COPY --from=rathole /app/rathole /usr/local/bin/rathole
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
