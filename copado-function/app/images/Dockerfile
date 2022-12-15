FROM alpine:3.16

# install copado dependencies ( python3, git, openssh, unzip )
# create "func" user and the /app working directory
# install Accenture SFMC DevTools
RUN apk add -y --no-cache python3 py3-pip bash git openssh unzip jq nodejs npm \
    && adduser func -u 1000 -g 1000 -D -s /bin/bash \
    && mkdir -p /app \
    && chown func:func /app \
    && npm install --global mcdev@4.2.0

USER func
WORKDIR /app
