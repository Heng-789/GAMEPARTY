# 🔥 Firebase Configuration

## 🎯 Multi-Tenant Firebase Setup

### 📁 Files Structure
- **`firebase.ts`**: Main Firebase configuration (currently MAX56)
- **`firebase-theme.ts`**: Theme-based Firebase configuration
- **`firebase-optimized.ts`**: Optimized Firebase services

### 🎨 Theme-Based Configuration

#### HENG36 Theme
```typescript
const heng36Config = {
  apiKey: "AIzaSyDU5OJNe9bF3xX3IwBAqT7v1QgxeRRzmzw",
  authDomain: "heng-15023.firebaseapp.com",
  projectId: "heng-15023",
  storageBucket: "heng-15023.appspot.com",
  messagingSenderId: "610549921124",
  appId: "1:610549921124:web:640e4e5b2c427c2d27f671",
  databaseURL: "https://heng-15023-default-rtdb.asia-southeast1.firebasedatabase.app"
}
```

#### MAX56 Theme
```typescript
const max56Config = {
  apiKey: "AIzaSyCq4J3neJr1jSIzOSN8_YeBmsvSChsuIBs",
  authDomain: "max56-98e6f.firebaseapp.com",
  projectId: "max56-98e6f",
  storageBucket: "max56-98e6f.firebasestorage.app",
  messagingSenderId: "698160116437",
  appId: "1:698160116437:web:13f03063724a621ee8e85c",
  databaseURL: "https://max56-98e6f-default-rtdb.asia-southeast1.firebasedatabase.app"
}
```

### 🚀 Usage

#### Development
```bash
# HENG36 Theme (uses heng-15023 Firebase)
npm run dev:heng

# MAX56 Theme (uses max56-98e6f Firebase)
npm run dev:max
```

#### Production
- **heng36.party** → HENG36 theme → `heng-15023` Firebase
- **max56.party** → MAX56 theme → `max56-98e6f` Firebase

### 🔍 Debug Information

#### Console Logs
```javascript
🔥 Firebase Configuration Debug:
Current Theme: max56
Firebase Project ID: max56-98e6f
Firebase Theme: max56
Firebase Project: max56-98e6f
Firebase App: [DEFAULT]
```

#### Theme Detection
```typescript
const getCurrentTheme = () => {
  const viteMode = import.meta.env.MODE
  if (viteMode === 'max56') return 'max56'
  if (viteMode === 'heng36') return 'heng36'
  
  // Fallback to hostname detection
  const hostname = window.location.hostname
  if (hostname.includes('max56')) return 'max56'
  if (hostname.includes('heng36')) return 'heng36'
  
  return 'heng36' // default
}
```

### 🎯 Current Configuration

#### Active Firebase Project
- **Project**: `max56-98e6f`
- **Theme**: MAX56
- **Mode**: `max56`
- **Database**: `https://max56-98e6f-default-rtdb.asia-southeast1.firebasedatabase.app`

### 🔧 Switching Firebase Projects

#### Method 1: Change Mode
```bash
# Switch to HENG36 Firebase
npm run dev:heng

# Switch to MAX56 Firebase
npm run dev:max
```

#### Method 2: Change Domain
```bash
# Add to hosts file
127.0.0.1 heng36.party
127.0.0.1 max56.party

# Access URLs
http://heng36.party:5173  # HENG36 Firebase
http://max56.party:5174   # MAX56 Firebase
```

### 📊 Database Structure

#### HENG36 Database (`heng-15023`)
```
/games
  /gameId
    /title: "Game Title"
    /theme: "heng36"
    /data: { ... }

/users
  /userId
    /name: "User Name"
    /theme: "heng36"
    /data: { ... }
```

#### MAX56 Database (`max56-98e6f`)
```
/games
  /gameId
    /title: "Game Title"
    /theme: "max56"
    /data: { ... }

/users
  /userId
    /name: "User Name"
    /theme: "max56"
    /data: { ... }
```

### 🎨 Theme Integration

#### Automatic Detection
- **Vite Mode**: `import.meta.env.MODE`
- **Hostname**: `window.location.hostname`
- **Fallback**: Default to HENG36

#### Firebase Selection
- **HENG36**: `heng-15023` project
- **MAX56**: `max56-98e6f` project
- **Auto-switch**: Based on theme detection

### 🚀 Production Deployment

#### Single Build
```bash
# Build once for both themes
npm run build

# Deploy to Netlify
# Add domain aliases: heng36.party, max56.party
```

#### Domain Configuration
- **heng36.party** → HENG36 theme → `heng-15023` Firebase
- **max56.party** → MAX56 theme → `max56-98e6f` Firebase

### 🔍 Troubleshooting

#### Common Issues
1. **Wrong Firebase Project**: Check theme detection
2. **Database Connection**: Verify database URL
3. **Authentication**: Check auth domain
4. **Theme Not Switching**: Clear browser cache

#### Debug Steps
1. Check console logs
2. Verify theme detection
3. Check Firebase configuration
4. Test database connection

### 📚 Resources

- **Firebase Console**: https://console.firebase.google.com/
- **HENG36 Project**: https://console.firebase.google.com/project/heng-15023
- **MAX56 Project**: https://console.firebase.google.com/project/max56-98e6f
- **Documentation**: https://firebase.google.com/docs
