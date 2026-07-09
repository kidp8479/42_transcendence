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
# create a non-root user (uid/gid 1000, matching common host dev-machine uids)
# so files generated at runtime (tmp/ build output) on the bind mount are
# host-user-owned instead of root-owned and can be cleaned with a plain host-side rm
RUN addgroup -g 1000 app && adduser -D -u 1000 -G app app
RUN chown app:app /app
USER app
COPY --chown=app:app go.mod go.sum* ./
RUN go mod download
COPY --chown=app:app . .
EXPOSE 3001
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
