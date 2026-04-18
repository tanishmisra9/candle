SHELL := /bin/bash

.PHONY: up down wait-db ingest backend frontend dev bootstrap

up:
	docker compose up -d

down:
	docker compose down

wait-db:
	@echo "Waiting for Postgres..."
	@until docker compose exec -T db pg_isready -U candle -d candle >/dev/null 2>&1; do \
		sleep 1; \
	done

ingest:
	cd backend && uv run python -m app.ingest.run

backend:
	cd backend && uv run uvicorn app.main:app --reload --port 8000

frontend:
	pnpm --dir frontend dev

dev:
	@trap 'kill 0' INT TERM EXIT; \
		$(MAKE) backend & \
		$(MAKE) frontend & \
		wait

bootstrap:
	cd backend && uv sync
	pnpm --dir frontend install
	$(MAKE) up
	$(MAKE) wait-db
	$(MAKE) ingest
	@echo "Starting Candle at http://localhost:5173 and http://localhost:8000"
	@trap 'kill 0' INT TERM EXIT; \
		$(MAKE) backend & \
		$(MAKE) frontend & \
		wait
