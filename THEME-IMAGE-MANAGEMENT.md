# 🖼️ Theme-Based Image Management System

ระบบจัดการรูปภาพแยกตามธีมสำหรับ Multi-tenant Application

## 📁 โครงสร้างไฟล์รูปภาพ

```
public/image/
├── 🎨 Theme-Specific Images
│   ├── logo-heng36.png          # โลโก้ HENG36
│   ├── logo-max56.png           # โลโก้ MAX56
│   ├── halloween_bg-heng36.jpg  # พื้นหลัง HENG36
│   ├── halloween_bg-max56.jpg   # พื้นหลัง MAX56
│   ├── card1-heng36.png         # การ์ด 1 HENG36
│   ├── card1-max56.png          # การ์ด 1 MAX56
│   ├── card2-heng36.png         # การ์ด 2 HENG36
│   ├── card2-max56.png          # การ์ด 2 MAX56
│   ├── card3-heng36.png         # การ์ด 3 HENG36
│   ├── card3-max56.png          # การ์ด 3 MAX56
│   ├── ghost-heng36.png         # ผี HENG36
│   ├── ghost-max56.png          # ผี MAX56
│   ├── haha-heng36.png          # ผีหัวเราะ HENG36
│   └── haha-max56.png           # ผีหัวเราะ MAX56
│
├── 🎮 Game Assets (Shared)
│   ├── Asset1.png - Asset10.png # สล็อต assets
│   ├── slot1.png                # สล็อตพิเศษ
│   └── ghostsound.mp3           # เสียงผี
│
└── 🎯 UI Icons (Shared)
    ├── bonus.svg, checkin.svg, coupon.svg
    ├── diamond.svg, jewels.svg, shop.svg
    ├── slot.svg, telegram.svg, user.svg
    └── close.svg, line.svg, right.svg
```

## 🎨 Theme Image Mapping

### HENG36 Theme (heng36.party)
- **Logo**: `logo-heng36.png`
- **Background**: `halloween_bg-heng36.jpg`
- **Cards**: `card1-heng36.png`, `card2-heng36.png`, `card3-heng36.png`
- **Ghost**: `ghost-heng36.png`, `haha-heng36.png`

### MAX56 Theme (max56.party)
- **Logo**: `logo-max56.png`
- **Background**: `halloween_bg-max56.jpg`
- **Cards**: `card1-max56.png`, `card2-max56.png`, `card3-max56.png`
- **Ghost**: `ghost-max56.png`, `haha-max56.png`

## 🛠️ การใช้งาน

### 1. ใช้ useThemeImages Hook

```tsx
import { useThemeImages } from '../hooks/useThemeAssets'

function MyComponent() {
  const themeImages = useThemeImages()
  
  return (
    <div>
      <img src={themeImages.logo} alt="Logo" />
      <img src={themeImages.card1} alt="Card 1" />
      <img src={themeImages.ghost} alt="Ghost" />
    </div>
  )
}
```

### 2. ใช้ getThemeImage Function

```tsx
import { useThemeImages } from '../hooks/useThemeAssets'

function MyComponent() {
  const { getThemeImage } = useThemeImages()
  
  return (
    <div>
      <img src={getThemeImage('card1')} alt="Card 1" />
      <img src={getThemeImage('ghost', 'png')} alt="Ghost" />
    </div>
  )
}
```

### 3. ใช้ Theme Assets ใน Context

```tsx
import { useThemeAssets } from '../contexts/ThemeContext'

function MyComponent() {
  const assets = useThemeAssets()
  
  return (
    <div style={{
      backgroundImage: assets.backgroundImage
    }}>
      <img src={assets.logo.replace('url("', '').replace('")', '')} alt="Logo" />
    </div>
  )
}
```

## 🔧 การเพิ่มรูปภาพใหม่

### 1. เพิ่มรูปภาพตามธีม

```bash
# สร้างไฟล์รูปภาพใหม่
cp new-image.png new-image-heng36.png
cp new-image.png new-image-max56.png
```

### 2. อัปเดต useThemeImages Hook

```typescript
// src/hooks/useThemeAssets.ts
export function useThemeImages() {
  // ... existing code
  
  return {
    // ... existing images
    newImage: getThemeImage('new-image'),
  }
}
```

### 3. อัปเดต Theme Configuration

```typescript
// src/config/themes.ts
assets: {
  // ... existing assets
  newImage: '/image/new-image-heng36.png', // สำหรับ HENG36
  // หรือ
  newImage: '/image/new-image-max56.png',  // สำหรับ MAX56
}
```

## 🎯 Best Practices

### 1. การตั้งชื่อไฟล์
- ใช้รูปแบบ: `{name}-{theme}.{extension}`
- ตัวอย่าง: `logo-heng36.png`, `card1-max56.png`

### 2. การจัดการขนาดไฟล์
- ใช้ WebP format สำหรับรูปภาพใหม่
- Optimize รูปภาพก่อนใช้งาน
- ใช้ responsive images สำหรับ mobile

### 3. การ Cache
- รูปภาพจะถูก cache โดย browser
- ใช้ versioning สำหรับการอัปเดต
- ใช้ CDN สำหรับ production

## 🚀 การ Deploy

### 1. Development
```bash
npm run dev
# รูปภาพจะโหลดจาก public/image/
```

### 2. Production
```bash
npm run build
# รูปภาพจะถูก copy ไปยัง dist/image/
```

### 3. CDN Setup
```bash
# อัปโหลดรูปภาพไปยัง CDN
aws s3 sync public/image/ s3://your-cdn-bucket/images/
```

## 🔍 การ Debug

### 1. ตรวจสอบรูปภาพที่โหลด
```javascript
// ใน Browser Console
const themeImages = useThemeImages()
console.log('Current theme images:', themeImages)
```

### 2. ตรวจสอบ Theme Detection
```javascript
// ใน Browser Console
import { debugDomainDetection } from './src/utils/domainDetection'
debugDomainDetection()
```

### 3. ตรวจสอบ CSS Variables
```javascript
// ใน Browser Console
const root = document.documentElement
const computedStyle = getComputedStyle(root)
console.log('Theme assets:', {
  logo: computedStyle.getPropertyValue('--theme-asset-logo'),
  background: computedStyle.getPropertyValue('--theme-asset-background-image'),
})
```

## 📊 Performance Monitoring

### 1. Image Loading Time
- ใช้ `onLoad` event สำหรับ monitor
- ใช้ `onError` event สำหรับ error handling

### 2. Cache Hit Rate
- ตรวจสอบ browser cache
- ใช้ Service Worker สำหรับ offline

### 3. Bundle Size
- ใช้ dynamic imports สำหรับรูปภาพ
- ใช้ lazy loading สำหรับรูปภาพใหญ่

## 🛡️ Security

### 1. Image Validation
- ตรวจสอบ file type และ size
- ใช้ Content Security Policy

### 2. XSS Protection
- Sanitize image URLs
- ใช้ trusted domains เท่านั้น

### 3. Access Control
- ใช้ authentication สำหรับรูปภาพ sensitive
- ใช้ signed URLs สำหรับ temporary access

---

## 📞 Support

หากมีปัญหาหรือต้องการความช่วยเหลือ:
- ตรวจสอบ console logs
- ดู Network tab ใน DevTools
- ติดต่อทีมพัฒนา
