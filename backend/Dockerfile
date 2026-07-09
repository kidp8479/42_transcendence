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
# run as the pre-existing non-root "node" user (uid/gid 1000 in this image)
# instead of root, so files generated at runtime (dist/, .flowbite-react/,
# *.tsbuildinfo, etc.) on the bind mount are host-user-owned instead of
# root-owned and can be cleaned with a plain host-side rm
RUN chown node:node /app
USER node
COPY --chown=node:node package*.json ./
# only schema.prisma is needed for "npm install" (its postinstall runs "prisma
# generate", which just reads the schema) - copying the whole prisma/ dir here
# would bust this layer's cache on every new migration file, forcing an
# unnecessary reinstall. prisma/migrations/ still gets included below via "COPY . ."
COPY --chown=node:node prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci
COPY --chown=node:node . .
EXPOSE 3000
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
