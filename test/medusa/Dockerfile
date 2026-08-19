# Disposable Medusa server for integration tests.
#
# The Medusa version is pinned in package.json. Medusa ships frequently, and an integration
# suite that silently follows the latest release fails for reasons unrelated to this node.
FROM node:22-slim

RUN apt-get update \
	&& apt-get install -y --no-install-recommends curl \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY medusa-config.js tsconfig.json ./
COPY src ./src

EXPOSE 9000

CMD ["npx", "medusa", "develop"]
