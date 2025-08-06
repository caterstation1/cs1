#!/bin/bash

# Railway Database Connection Script
# This script helps you connect to your Railway PostgreSQL database

echo "🚂 Railway Database Connection"
echo "=============================="
echo ""

# Connection details from Railway
DB_HOST="mainline.proxy.rlwy.net"
DB_PORT="41096"
DB_NAME="railway"
DB_USER="postgres"
DB_PASSWORD="tgFMycdsDzCztdcXyQCpEFvEAJuCwEql"

echo "Connection Details:"
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

echo "Options:"
echo "1. Connect using psql (if installed)"
echo "2. Show connection URL"
echo "3. Show Railway CLI command"
echo "4. Exit"
echo ""

read -p "Choose an option (1-4): " choice

case $choice in
    1)
        echo "Connecting to Railway database..."
        echo "Note: You may be prompted for the password: $DB_PASSWORD"
        echo ""
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -p "$DB_PORT" -d "$DB_NAME"
        ;;
    2)
        echo "Connection URL:"
        echo "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
        echo ""
        echo "You can use this URL with any PostgreSQL client."
        ;;
    3)
        echo "Railway CLI command:"
        echo "railway connect Postgres"
        echo ""
        echo "Make sure you have Railway CLI installed and are logged in."
        ;;
    4)
        echo "Goodbye!"
        exit 0
        ;;
    *)
        echo "Invalid option. Please choose 1-4."
        exit 1
        ;;
esac 