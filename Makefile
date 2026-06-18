# **************************************************************************** #
#                                                                              #
#                                                         :::      ::::::::    #
#    Makefile                                           :+:      :+:    :+:    #
#                                                     +:+ +:+         +:+      #
#    By: abelov <abelov@student.42london.com>       +#+  +:+       +#+         #
#                                                 +#+#+#+#+#+   +#+            #
#    Created: 2026/06/18 18:04:43 by abelov            #+#    #+#              #
#    Updated: 2026/06/18 18:04:43 by abelov           ###   ########.fr        #
#                                                                              #
# **************************************************************************** #

COMPOSE = docker compose
ENV_FILE = .env

# ---------------------------------------------------------------------------- #
# default                                                                      #
# ---------------------------------------------------------------------------- #

## all
all: up


# ---------------------------------------------------------------------------- #
# env guard                                                                    #
# ---------------------------------------------------------------------------- #


$(ENV_FILE):
	@echo "No .env found. Copying .env.example.."
	cp .env.example $(ENV_FILE)


# ---------------------------------------------------------------------------- #
# lifecycle                                                                    #
# ---------------------------------------------------------------------------- #

## up
up: $(ENV_FILE)
	$(COMPOSE) up --build -d

## down
down:
	$(COMPOSE) down

## restart
restart:
	$(COMPOSE) restart

## build
build:
	$(COMPOSE) build


# ---------------------------------------------------------------------------- #
# individual services                                                          #
# ---------------------------------------------------------------------------- #

up-db:     $(ENV_FILE) ; $(COMPOSE) up -d db
up-frontend: $(ENV_FILE) ; $(COMPOSE) up --build -d frontend
up-backend:  $(ENV_FILE) ; $(COMPOSE) up --build -d backend
up-auth:     $(ENV_FILE) ; $(COMPOSE) up --build -d auth


# ---------------------------------------------------------------------------- #
# logs                                                                         #
# ---------------------------------------------------------------------------- #

## logs
logs:
	$(COMPOSE) logs -f

## logs-frontend
logs-frontend:
	$(COMPOSE) logs -f frontend

## logs-backend
logs-backend:
	$(COMPOSE) logs -f backend

## logs-auth
logs-auth:
	$(COMPOSE) logs -f auth

## logs-db
logs-db:
	$(COMPOSE) logs -f db


# ---------------------------------------------------------------------------- #
# shells                                                                       #
# ---------------------------------------------------------------------------- #

## shell-frontend
shell-frontend:
	$(COMPOSE) exec frontend sh

## shell-backend
shell-backend:
	$(COMPOSE) exec backend sh

## shell-auth
shell-auth:
	$(COMPOSE) exec auth sh

## shell-db
shell-db:
	$(COMPOSE) exec db psql -U $${POSTGRES_USER} $${POSTGRES_DB}


# ---------------------------------------------------------------------------- #
# database                                                                     #
# ---------------------------------------------------------------------------- #

## migrate
migrate:
	$(COMPOSE) exec backend npx prisma migrate dev

## prisma-studio
prisma-studio:
	$(COMPOSE) exec backend npx prisma studio --browser none


# ---------------------------------------------------------------------------- #
# status                                                                       #
# ---------------------------------------------------------------------------- #

## ps
ps:
	$(COMPOSE) ps


# ---------------------------------------------------------------------------- #
# cleanup                                                                       #
# ---------------------------------------------------------------------------- #

## clean
clean:
	$(COMPOSE) down --remove-orphans

## fclean
fclean:
	$(COMPOSE) down --volumes --remove-orphans --rmi local

## re
re: fclean
	+$(MAKE) up


# Magic help adapted: from https://gitlab.com/depressiveRobot/make-help/blob/master/help.mk (MIT License)
help:
	@printf "\nAvailable targets:\n\n"
	@awk -F: '/^[a-zA-Z\-_0-9%\\ ]+:/ { \
			helpMessage = match(lastLine, /^## (.*)/); \
			if (helpMessage) { \
					helpCommand = $$1; \
					helpMessage = substr(lastLine, RSTART + 3, RLENGTH); \
					printf "  \x1b[32;01m%-35s\x1b[0m %s\n", helpCommand, helpMessage; \
			} \
	} \
	{ lastLine = $$0 }' $(MAKEFILE_LIST) | sort -u
	@printf "\n"

.PHONY: all up down restart build logs ps clean fclean re \
        up-db up-frontend up-backend up-auth \
        logs-frontend logs-backend logs-auth logs-db \
        shell-frontend shell-backend shell-auth shell-db \
        migrate prisma-studio