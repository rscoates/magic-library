# Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

COPY frontend/ .
RUN npm run build

# Final image
FROM python:3.11-slim

WORKDIR /app

# Install nginx, supervisor, and postgresql
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    postgresql \
    postgresql-contrib \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/lib/postgresql/*/bin/* /usr/local/bin/

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Create directories
RUN mkdir -p /app/data /var/lib/postgresql/data /run/postgresql /var/log/supervisor \
    && chown -R postgres:postgres /var/lib/postgresql /run/postgresql

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.combined.conf /etc/nginx/sites-available/default

# Copy supervisor config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copy database init script
COPY init-db.sh /init-db.sh
RUN chmod +x /init-db.sh && \
    sed -i 's/\r$//' /init-db.sh

# Environment defaults
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/magic_library
ENV PGDATA=/var/lib/postgresql/data

EXPOSE 80

VOLUME ["/var/lib/postgresql/data", "/app/data"]

CMD ["/init-db.sh"]
