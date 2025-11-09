# 🎮 Multi-Tenant Game System

ระบบจัดการเกมที่รองรับธีมหลายแบบในโปรเจกต์เดียว โดยเปลี่ยนธีมอัตโนมัติตามโดเมน

## 🌐 Domain Configuration

### HENG36 Theme
- **Domain**: `heng36.party`
- **Theme**: สีเขียว-ส้ม
- **Logo**: `HENG36_logo_title.png`
- **Firebase**: `heng-15023`

### MAX56 Theme
- **Domain**: `max56.party`
- **Theme**: สีแดง-ส้ม
- **Logo**: `max56.png`
- **Firebase**: `max56-98e6f`

## 🚀 Deployment

### Netlify Deployment
1. **Connect Repository**: เชื่อมต่อ repository กับ Netlify
2. **Build Settings**:
   - Build Command: `npm run build`
   - Publish Directory: `dist`
   - Node Version: `18`

3. **Domain Aliases**:
   - เพิ่ม `heng36.party` เป็น domain alias
   - เพิ่ม `max56.party` เป็น domain alias
   - Netlify จะจัดการ SSL และ redirects อัตโนมัติ

### Manual Deployment
```bash
# Build
npm run build

# Deploy to Netlify
npx netlify deploy --prod --dir=dist
```

## 🎨 Theme System

### Automatic Theme Detection
ระบบจะตรวจสอบ hostname และเปลี่ยนธีมอัตโนมัติ:

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

### Theme Configuration
```typescript
// src/config/themes.ts
export const themes = {
  heng36: {
    name: 'heng36',
    displayName: 'HENG36 PARTY',
    domain: 'heng36.party',
    colors: { /* สีเขียว-ส้ม */ },
    assets: { /* โลโก้และรูปภาพ */ }
  },
  max56: {
    name: 'max56',
    displayName: 'MAX56 GAME',
    domain: 'max56.party',
    colors: { /* สีแดง-ส้ม */ },
    assets: { /* โลโก้และรูปภาพ */ }
  }
}
```

## 🔥 Firebase Configuration

### Single Firebase Project
ใช้ Firebase project เดียวสำหรับทั้งสองธีม:

```typescript
// src/services/firebase.ts
const firebaseConfig = {
  apiKey: "AIzaSyDU5OJNe9bF3xX3IwBAqT7v1QgxeRRzmzw",
  authDomain: "heng-15023.firebaseapp.com",
  projectId: "heng-15023",
  // ... config อื่นๆ
}
```

### Theme-Based Data Structure
```javascript
// Firebase Database Structure
{
  "games": {
    "gameId": {
      "title": "Game Title",
      "theme": "heng36", // หรือ "max56"
      "data": { /* ข้อมูลเกม */ }
    }
  },
  "users": {
    "userId": {
      "name": "User Name",
      "theme": "heng36", // หรือ "max56"
      "data": { /* ข้อมูลผู้ใช้ */ }
    }
  }
}
```

## 🎯 Features

### ✅ Multi-Tenant Support
- **Single Build**: ใช้ build เดียวสำหรับทั้งสองธีม
- **Domain Detection**: เปลี่ยนธีมอัตโนมัติตามโดเมน
- **Theme Switching**: เปลี่ยนธีมได้แบบ real-time
- **Asset Management**: จัดการรูปภาพแยกตามธีม

### ✅ Firebase Integration
- **Single Project**: ใช้ Firebase project เดียว
- **Theme-Based Data**: แยกข้อมูลตามธีม
- **Authentication**: ระบบเข้าสู่ระบบเดียว
- **Real-time Updates**: อัปเดตแบบ real-time

### ✅ Netlify Features
- **SSL**: SSL certificate อัตโนมัติ
- **Domain Aliases**: รองรับหลายโดเมน
- **CDN**: Content Delivery Network
- **Form Handling**: จัดการฟอร์ม
- **Functions**: Serverless functions

## 🛠️ Development

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Theme Testing
```bash
# ทดสอบธีม HENG36
# เข้า http://localhost:5173

# ทดสอบธีม MAX56
# เข้า http://localhost:5173 และเปลี่ยนธีมใน ThemeTest page
```

## 📁 Project Structure

```
src/
├── components/          # React components
├── pages/              # Page components
├── contexts/           # React contexts
├── config/             # Configuration files
├── services/           # Firebase services
├── styles/             # CSS files
└── types/              # TypeScript types

public/
├── image/              # Image assets
│   ├── HENG36_logo_title.png
│   ├── max56.png
│   └── ...
└── _redirects         # Netlify redirects
```

## 🎨 Customization

### Adding New Themes
1. เพิ่มธีมใหม่ใน `src/config/themes.ts`
2. เพิ่มรูปภาพใน `public/image/`
3. อัปเดต domain detection logic
4. ทดสอบธีมใหม่

### Custom Domain
1. เพิ่ม domain alias ใน Netlify
2. อัปเดต `getThemeFromDomain` function
3. เพิ่มธีมใหม่ใน themes configuration

## 🚀 Production Deployment

### Netlify Setup
1. **Repository**: เชื่อมต่อ GitHub repository
2. **Build Settings**: ใช้ `netlify.toml` configuration
3. **Domain**: เพิ่ม domain aliases
4. **SSL**: เปิดใช้งาน SSL
5. **Deploy**: Deploy อัตโนมัติ

### Domain Configuration
- **heng36.party**: ธีม HENG36
- **max56.party**: ธีม MAX56
- **Custom Domain**: เพิ่มได้ตามต้องการ

## 📊 Monitoring

### Analytics
- **Netlify Analytics**: ดูสถิติการใช้งาน
- **Firebase Analytics**: ดูสถิติแอป
- **Custom Analytics**: เพิ่ม analytics ตามต้องการ

### Performance
- **Core Web Vitals**: ตรวจสอบประสิทธิภาพ
- **Lighthouse**: ตรวจสอบ SEO และ Performance
- **Bundle Analysis**: วิเคราะห์ขนาด bundle

## 🔧 Troubleshooting

### Common Issues
1. **Theme Not Changing**: ตรวจสอบ hostname detection
2. **Images Not Loading**: ตรวจสอบ path ของรูปภาพ
3. **Firebase Error**: ตรวจสอบ Firebase configuration
4. **Build Error**: ตรวจสอบ dependencies

### Debug Mode
```typescript
// เปิด debug mode
console.log('Current hostname:', window.location.hostname)
console.log('Current theme:', themeName)
console.log('Theme config:', theme)
```

## 📚 Documentation

- **Theme System**: `src/config/themes.ts`
- **Firebase**: `src/services/firebase.ts`
- **Components**: `src/components/`
- **Pages**: `src/pages/`

## 🎯 Conclusion

ระบบ Multi-Tenant Game System ให้ความยืดหยุ่นสูงในการจัดการธีมหลายแบบในโปรเจกต์เดียว พร้อมรองรับการ deploy แบบ single build และการเปลี่ยนธีมอัตโนมัติตามโดเมน