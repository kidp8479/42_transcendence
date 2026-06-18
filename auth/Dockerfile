FROM golang:1.24-alpine AS dev
WORKDIR /app
RUN go install github.com/air-verse/air@v1.61.7
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
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
