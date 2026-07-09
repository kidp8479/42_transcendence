#################################################################
# Creates a Backend (NestJS) image based on Node Alpine
#                    ##        .
#              ## ## ##       ==
#           ## ## ## ##      ===
#       /""""""""""""""""\___/ ===
#  ~~~ {~~ ~~~~ ~~~ ~~~~ ~~ ~ /  ===- ~~~
#       \______ o          __/
#         \    \        __/
#          \____\______/
# Author:		abelov <abelov@student.42london.com>
# Contributor:	abelov <abelov@student.42london.com>
# License:
# Version:		v0.1.0
#################################################################

FROM node:22-alpine AS dev
WORKDIR /app
# build everything as root: rootless Podman's build phase (buildah under the
# hood) doesn't reliably persist a chown across a later USER switch within
# the same build (a known rootless-overlay-storage limitation), so trying to
# become non-root mid-build is fragile across engines. Instead, run the
# entrypoint (which starts as root) to chown things and drop to "node" via
# su-exec at container *runtime* instead - see docker-entrypoint.sh.
RUN apk add --no-cache su-exec
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
COPY package*.json ./
# only schema.prisma is needed for "npm install" (its postinstall runs "prisma
# generate", which just reads the schema) - copying the whole prisma/ dir here
# would bust this layer's cache on every new migration file, forcing an
# unnecessary reinstall. prisma/migrations/ still gets included below via "COPY . ."
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci
COPY . .
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "start:dev"]

FROM dev AS build
RUN npm run build

FROM node:22-alpine AS prod
WORKDIR /app

# Only production deps, install fresh instead of inheriting devDependencies from the build stage
COPY package*.json ./
COPY prisma/ ./prisma/
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# node:22-alpine already ships a non-root "node" user - just switch to it
USER node

EXPOSE 3000
CMD ["node", "dist/main"]
