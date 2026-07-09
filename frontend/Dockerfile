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
# run as the pre-existing non-root "node" user instead of root,
# so files generated at runtime (dist/, .vite/, .flowbite-react/, etc.)
# on the bind mount are host-user-owned instead of root-owned and can be
# cleaned with a plain host-side rm
RUN chown node:node /app
RUN apk add --no-cache su-exec
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
USER node
COPY --chown=node:node package*.json ./
RUN npm install
COPY --chown=node:node . .
# switch back to root so the container starts as root: the entrypoint fixes
# up ownership of the named node_modules volume (see docker-entrypoint.sh for
# why that's needed) before dropping back down to "node" to run the app
USER root
EXPOSE 5173
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "dev", "--", "--host"]

FROM dev AS build
RUN npm run build

FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
