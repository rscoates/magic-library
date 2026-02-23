#!/bin/bash
set -e

# Initialize PostgreSQL if data directory is empty
if [ -z "$(ls -A /var/lib/postgresql/data 2>/dev/null)" ]; then
    echo "Initializing PostgreSQL database..."
    
    # Initialize database cluster
    su postgres -c "/usr/lib/postgresql/15/bin/initdb -D /var/lib/postgresql/data"
    
    # Configure PostgreSQL to accept local connections
    echo "host all all 127.0.0.1/32 trust" >> /var/lib/postgresql/data/pg_hba.conf
    echo "local all all trust" >> /var/lib/postgresql/data/pg_hba.conf
    
    # Start PostgreSQL temporarily to create database
    su postgres -c "/usr/lib/postgresql/15/bin/pg_ctl -D /var/lib/postgresql/data -w start"
    
    # Create database and user
    su postgres -c "psql -c \"CREATE DATABASE magic_library;\""
    
    # Run alembic migrations
    cd /app
    alembic upgrade head
    
    # Stop PostgreSQL (supervisor will start it properly)
    su postgres -c "/usr/lib/postgresql/15/bin/pg_ctl -D /var/lib/postgresql/data -w stop"
    
    echo "Database initialization complete."
else
    echo "Database already initialized, running migrations..."
    
    # Start PostgreSQL temporarily to run migrations
    su postgres -c "/usr/lib/postgresql/15/bin/pg_ctl -D /var/lib/postgresql/data -w start"
    
    cd /app
    alembic upgrade head
    
    su postgres -c "/usr/lib/postgresql/15/bin/pg_ctl -D /var/lib/postgresql/data -w stop"
fi

# Start supervisor (which will start all services)
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
