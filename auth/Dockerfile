#################################################################
# Creates an Auth service image based on Go Alpine
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

FROM golang:1.24-alpine AS dev
WORKDIR /app
# install air as root, then move the binary somewhere on PATH that's readable
# by any user, since "go install" here defaults to root's GOPATH ($HOME/go/bin)
RUN go install github.com/air-verse/air@v1.61.7 \
    && mv /go/bin/air /usr/local/bin/air
RUN apk add --no-cache su-exec
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
# create a non-root user (uid/gid 1000, matching common host dev-machine uids)
# for the entrypoint to drop privileges to at runtime via su-exec. Build
# everything else as root: rootless Podman's build phase (buildah under the
# hood) doesn't reliably persist a chown across a later USER switch within
# the same build (a known rootless-overlay-storage limitation), so trying to
# become non-root mid-build is fragile across engines.
RUN addgroup -g 1000 app && adduser -D -u 1000 -G app app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
EXPOSE 3001
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["air"]

FROM golang:1.24-alpine AS build
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o auth-service ./cmd/auth

FROM alpine:3.20 AS prod
WORKDIR /app
COPY --from=build /app/auth-service .
EXPOSE 3001
CMD ["./auth-service"]
