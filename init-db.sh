#!/bin/bash
set -e

# Initialize PostgreSQL data directory if empty
if [ ! -s /var/lib/postgresql/data/PG_VERSION ]; then
    echo "Initializing PostgreSQL database..."
    chown -R postgres:postgres /var/lib/postgresql/data
    su postgres -c "initdb -D /var/lib/postgresql/data"
fi

# Start PostgreSQL temporarily for migrations
su postgres -c "pg_ctl -D /var/lib/postgresql/data -l /var/log/postgresql.log start"

# Wait for PostgreSQL to be ready
until su postgres -c "pg_isready" > /dev/null 2>&1; do
    echo "Waiting for PostgreSQL..."
    sleep 1
done

# Create database if it doesn't exist
su postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname = 'magic_library'\" | grep -q 1 || psql -c \"CREATE DATABASE magic_library\""

# Run Alembic migrations
cd /app
alembic upgrade head

# Stop PostgreSQL (supervisord will start it properly)
su postgres -c "pg_ctl -D /var/lib/postgresql/data stop"

echo "Database initialization complete."

# Start supervisord
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
