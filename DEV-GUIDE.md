# 🚀 Development Guide

## 💡 วิธีใช้ตอน Dev

### 1. 🎨 .env + mode
```bash
# HENG36 Theme
npm run dev -- --mode heng36

# MAX56 Theme  
npm run dev -- --mode max56
```

### 2. 📜 npm script + env
```bash
# HENG36 Theme
npm run dev:heng
npm run dev:heng36

# MAX56 Theme
npm run dev:max
npm run dev:max56
```

### 3. 🌐 hosts file
```bash
# จำลองโดเมนจริงบน localhost
# Copy hosts.dev to C:\Windows\System32\drivers\etc\hosts

# แล้วเข้า:
http://heng36.party:5173
http://max56.party:5174
```

## 🎯 Quick Start

### Method 1: npm scripts (แนะนำ)
```bash
# HENG36 Theme
npm run dev:heng
# เข้า http://localhost:5173

# MAX56 Theme
npm run dev:max
# เข้า http://localhost:5174
```

### Method 2: mode parameter
```bash
# HENG36 Theme
npm run dev -- --mode heng36

# MAX56 Theme
npm run dev -- --mode max56
```

### Method 3: hosts file (จำลองโดเมนจริง)
```bash
# 1. Copy hosts.dev to system hosts file
# 2. Run dev servers
npm run dev:heng  # Port 5173
npm run dev:max   # Port 5174

# 3. เข้า:
http://heng36.party:5173
http://max56.party:5174
```

## 🔧 Configuration

### Environment Files
- **`env.heng36`**: HENG36 theme configuration
- **`env.max56`**: MAX56 theme configuration

### Hosts File
- **`hosts.dev`**: Domain simulation for localhost

### Vite Config
- **Mode-based**: Load env file based on mode
- **Port**: Different ports for each theme
- **Define**: Theme and domain variables

## 🎨 Theme Detection

### Automatic Detection
```typescript
// ถ้าเป็น max56.party หรือ subdomain ของ max56
if (hostname.includes('max56')) {
  return 'max56'
}

// ถ้าเป็น heng36.party หรือ subdomain ของ heng36
if (hostname.includes('heng36')) {
  return 'heng36'
}

// default เป็น heng36
return 'heng36'
```

### Manual Override
```typescript
// ใช้ VITE_THEME จาก env file
const theme = import.meta.env.VITE_THEME || 'heng36'
```

## 🌐 Domain Simulation

### Hosts File Setup
```bash
# Windows
C:\Windows\System32\drivers\etc\hosts

# Add these lines:
127.0.0.1 heng36.party
127.0.0.1 max56.party
```

### Access URLs
- **HENG36**: `http://heng36.party:5173`
- **MAX56**: `http://max56.party:5174`
- **Localhost**: `http://localhost:5173` (default HENG36)

## 🎯 Development Workflow

### 1. Start Development
```bash
# Choose your method:
npm run dev:heng    # HENG36 theme
npm run dev:max     # MAX56 theme
```

### 2. Test Theme Switching
```bash
# Go to theme test page
http://localhost:5173/theme-test
```

### 3. Build for Production
```bash
# Build both themes
npm run build:heng
npm run build:max

# Or build default
npm run build
```

## 🔍 Debug Mode

### Console Logs
```typescript
console.log('Current theme:', themeName)
console.log('Current domain:', window.location.hostname)
console.log('Theme config:', theme)
```

### Environment Variables
```typescript
console.log('VITE_THEME:', import.meta.env.VITE_THEME)
console.log('VITE_DOMAIN:', import.meta.env.VITE_DOMAIN)
console.log('VITE_PORT:', import.meta.env.VITE_PORT)
```

## 🚀 Production Deployment

### Single Build
```bash
# Build once for both domains
npm run build

# Deploy to Netlify
# Add domain aliases: heng36.party, max56.party
```

### Domain Aliases
- **heng36.party** → HENG36 theme
- **max56.party** → MAX56 theme
- **Netlify** handles SSL and redirects

## 🎨 Theme Customization

### Adding New Themes
1. Create new env file: `env.newtheme`
2. Add npm script: `"dev:new": "vite --mode newtheme"`
3. Update theme detection logic
4. Test with: `npm run dev:new`

### Custom Domains
1. Add to hosts file
2. Update `getThemeFromDomain` function
3. Add to Netlify domain aliases

## 📊 Performance

### Development
- **HMR**: Hot Module Replacement
- **Fast Refresh**: React Fast Refresh
- **Source Maps**: Full source maps

### Production
- **Code Splitting**: Automatic code splitting
- **Tree Shaking**: Remove unused code
- **Minification**: Minify CSS and JS

## 🔧 Troubleshooting

### Common Issues
1. **Port Already in Use**: Change port in env file
2. **Theme Not Changing**: Check hostname detection
3. **Hosts File Not Working**: Run as administrator
4. **Build Error**: Check dependencies

### Debug Steps
1. Check console logs
2. Verify environment variables
3. Test theme detection
4. Check network requests

## 🎯 Best Practices

### Development
- Use `npm run dev:heng` for HENG36
- Use `npm run dev:max` for MAX56
- Test both themes regularly
- Use hosts file for domain simulation

### Production
- Build once, deploy everywhere
- Use Netlify domain aliases
- Monitor performance
- Test on real domains

## 📚 Resources

- **Vite**: https://vitejs.dev/
- **React**: https://react.dev/
- **Netlify**: https://netlify.com/
- **Hosts File**: https://en.wikipedia.org/wiki/Hosts_(file)
