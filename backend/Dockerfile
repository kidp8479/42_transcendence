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
COPY package*.json ./
# only schema.prisma is needed for "npm install" (its postinstall runs "prisma
# generate", which just reads the schema) - copying the whole prisma/ dir here
# would bust this layer's cache on every new migration file, forcing an
# unnecessary reinstall. prisma/migrations/ still gets included below via "COPY . ."
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

FROM dev AS build
RUN npm run build

FROM node:22-alpine AS prod
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/main"]
