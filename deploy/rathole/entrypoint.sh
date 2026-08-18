#!/bin/sh
set -e

if [ -z "$RATHOLE_TOKEN" ]; then
	echo "FATAL: RATHOLE_TOKEN environment variable is not set" >&2
	exit 1
fi

# The mounted config is a template; substitute the token then run rathole.
envsubst < /app/config.template.toml > /app/config.generated.toml
exec /usr/local/bin/rathole /app/config.generated.toml
