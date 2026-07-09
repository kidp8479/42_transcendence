#################################################################
# Creates a Frontend (React + Vite) image based on Node Alpine
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
RUN npm install
COPY . .
EXPOSE 5173
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "dev", "--", "--host"]

FROM dev AS build
RUN npm run build

FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
