#!/bin/bash

echo "🔗 Connecting to Railway PostgreSQL database..."
echo "Please enter your Railway database password:"
read -s PASSWORD

echo "Connecting to database..."
PGPASSWORD=$PASSWORD psql -h mainline.proxy.rlwy.net -U postgres -p 41096 -d railway 