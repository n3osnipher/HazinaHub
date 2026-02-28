#!/bin/bash
# HazinaHub Deployment Script
set -e

echo "🚀 Deploying HazinaHub..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

# Build and start services
echo "📦 Building Docker images..."
docker compose -f infrastructure/docker/docker-compose.yml build

echo "🗄️ Starting database..."
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres
sleep 5

echo "🔧 Running migrations..."
docker compose -f infrastructure/docker/docker-compose.yml up -d api
sleep 3

echo "🌐 Starting web frontend..."
docker compose -f infrastructure/docker/docker-compose.yml up -d web

echo "🔄 Starting Nginx reverse proxy..."
docker compose -f infrastructure/docker/docker-compose.yml up -d nginx

echo "✅ HazinaHub deployed successfully!"
echo "   Web: http://localhost:3000"
echo "   API: http://localhost:5000"
echo "   Proxy: http://localhost:80"
