#!/bin/bash
# Create backend/.env file from template

echo "🔧 Creating backend/.env file..."

if [ -f .env ]; then
    echo "⚠️  .env file already exists!"
    echo "Do you want to overwrite it? (y/N)"
    read -r overwrite
    if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
        echo "❌ Cancelled. .env file not created."
        exit 1
    fi
fi

echo ""
echo "Creating .env file with database connections..."

cat > .env << 'EOF'
# Backend Environment Variables
# PostgreSQL Database Connections

# HENG36 Database
DATABASE_URL_HENG36=postgresql://postgres.ipflzfxezdzbmoqglknu:2gg0nj4k9N59aOly@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require

# MAX56 Database
DATABASE_URL_MAX56=postgresql://postgres.aunfaslgmxxdeemvtexn:MlmH1jKzFwEpqks8@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require

# Server Configuration
PORT=3000

# Optional: Database Pool Configuration
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
EOF

echo ""
echo "✅ .env file created successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Review .env file"
echo "   2. Run: npm run dev"
echo ""

