#!/bin/bash

echo "🚀 Setting up Development Environment..."

echo ""
echo "📁 Creating environment files..."
if [ ! -f "env.heng36" ]; then
    cat > env.heng36 << EOF
VITE_THEME=heng36
VITE_DOMAIN=heng36.party
VITE_PORT=5173
EOF
    echo "✅ Created env.heng36"
else
    echo "⚠️ env.heng36 already exists"
fi

if [ ! -f "env.max56" ]; then
    cat > env.max56 << EOF
VITE_THEME=max56
VITE_DOMAIN=max56.party
VITE_PORT=5174
EOF
    echo "✅ Created env.max56"
else
    echo "⚠️ env.max56 already exists"
fi

echo ""
echo "🌐 Setting up hosts file..."
echo ""
echo "📝 Please add these lines to your hosts file:"
echo "   /etc/hosts"
echo ""
echo "127.0.0.1 heng36.party"
echo "127.0.0.1 max56.party"
echo ""
echo "⚠️ You need sudo privileges to edit hosts file"
echo ""

echo "🎯 Development Commands:"
echo ""
echo "HENG36 Theme:"
echo "  npm run dev:heng"
echo "  http://localhost:5173"
echo "  http://heng36.party:5173 (with hosts file)"
echo ""
echo "MAX56 Theme:"
echo "  npm run dev:max"
echo "  http://localhost:5174"
echo "  http://max56.party:5174 (with hosts file)"
echo ""

echo "🚀 Ready to develop!"
