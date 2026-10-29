#!/bin/sh
# Runs once, when the Postgres volume is first created: a separate database for n8n itself.
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE DATABASE n8n OWNER $POSTGRES_USER;"
