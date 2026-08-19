# Disposable Medusa server for integration tests.
#
# The Medusa version is pinned in package.json. Medusa ships frequently, and an integration
# suite that silently follows the latest release fails for reasons unrelated to this node.
FROM node:22-slim

RUN apt-get update \
	&& apt-get install -y --no-install-recommends curl \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

# package-lock.json is committed and npm ci is used deliberately. Pinning Medusa's version alone
# leaves its whole dependency tree floating, so every image build resolved fresh against whatever
# the registry happened to hold at that moment. That is not a hypothetical: a CI run failed with
# "No matching version found for @aws-sdk/client-s3@^3.1114.0" on a documentation-only change,
# because a transitive dependency had shifted underneath a build that touched no code.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY medusa-config.js tsconfig.json ./
COPY src ./src

EXPOSE 9000

CMD ["npx", "medusa", "develop"]
