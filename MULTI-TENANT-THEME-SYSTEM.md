# 🎨 Multi-Tenant Theme System

ระบบ Multi-tenant ที่สามารถเปลี่ยนธีม, โลโก้, และสีอัตโนมัติตามโดเมนที่เปิดเข้าเว็บ

## 🌐 โดเมนที่รองรับ

- **https://heng36.party** → ธีม HENG36 (สีเขียว)
- **https://max56.party** → ธีม MAX56 (สีแดง)
- **localhost** → ธีม HENG36 (สำหรับ development)

## 🚀 ฟีเจอร์หลัก

### ✨ Automatic Theme Detection
- ระบบจะตรวจสอบโดเมนอัตโนมัติเมื่อโหลดหน้า
- เปลี่ยนธีม, สี, โลโก้, และ branding ทันที
- รองรับ subdomain และ development environment

### 🎨 Dynamic Theme System
- **Colors**: สีหลัก, สีรอง, สีเน้น, สีสถานะ
- **Gradients**: พื้นหลังแบบไล่สี
- **Typography**: ฟอนต์และขนาดตัวอักษร
- **Assets**: โลโก้, พื้นหลัง, favicon
- **Branding**: ชื่อ, คำอธิบาย, metadata

### 🔧 Theme Components
- `DynamicLogo` - โลโก้ที่เปลี่ยนตามธีม
- `DynamicTitle` - ชื่อที่เปลี่ยนตามธีม
- `ThemeInfo` - แสดงข้อมูลธีมปัจจุบัน
- `ThemeTest` - หน้าทดสอบธีม

## 📁 โครงสร้างไฟล์

```
src/
├── types/
│   └── theme.ts                 # Type definitions
├── config/
│   └── themes.ts               # Theme configurations
├── contexts/
│   └── ThemeContext.tsx        # Theme context & hooks
├── components/
│   ├── DynamicLogo.tsx         # Dynamic logo component
│   ├── DynamicTitle.tsx        # Dynamic title component
│   └── ThemeInfo.tsx           # Theme info component
├── utils/
│   ├── domainDetection.ts     # Domain detection logic
│   └── themeDebug.ts          # Debug utilities
└── pages/
    └── ThemeTest.tsx          # Theme testing page
```

## 🛠️ การใช้งาน

### 1. การใช้ Theme Context

```tsx
import { useTheme, useThemeColors, useThemeBranding } from '../contexts/ThemeContext'

function MyComponent() {
  const { theme, themeName, setTheme } = useTheme()
  const colors = useThemeColors()
  const branding = useThemeBranding()

  return (
    <div style={{ color: colors.primary }}>
      <h1>{branding.title}</h1>
    </div>
  )
}
```

### 2. การใช้ Dynamic Components

```tsx
import DynamicLogo from '../components/DynamicLogo'
import DynamicTitle from '../components/DynamicTitle'

function Header() {
  return (
    <header>
      <DynamicLogo width={60} height={60} showText={true} />
      <DynamicTitle level={1} showSubtitle={true} centered={true} />
    </header>
  )
}
```

### 3. การใช้ CSS Variables

```css
.my-component {
  background: var(--theme-gradient-primary);
  color: var(--theme-text-primary);
  border: 1px solid var(--theme-border-light);
}
```

## 🎯 การทดสอบ

### 1. ทดสอบใน Browser
- เปิด `http://localhost:5173/theme-test`
- ดูการเปลี่ยนธีมแบบ real-time
- ทดสอบการเปลี่ยนสีและ components

### 2. ทดสอบ Domain Detection
```javascript
// ใน Browser Console
import { debugDomainDetection } from './src/utils/domainDetection'
debugDomainDetection()
```

### 3. ทดสอบ Theme Switching
```javascript
// ใน Browser Console
import { debugThemeSystem } from './src/utils/themeDebug'
debugThemeSystem()
```

## 🔧 การตั้งค่า

### 1. เพิ่มธีมใหม่

```typescript
// src/config/themes.ts
export const themes: Record<ThemeName, ThemeConfig> = {
  // ... existing themes
  newtheme: {
    name: 'newtheme',
    displayName: 'NEW THEME',
    domain: 'newtheme.party',
    colors: {
      primary: '#FF6B6B',
      // ... other colors
    },
    // ... other config
  }
}
```

### 2. เพิ่มโดเมนใหม่

```typescript
// src/utils/domainDetection.ts
const DOMAIN_MAP: Record<string, ThemeName> = {
  // ... existing domains
  'newtheme.party': 'newtheme',
}
```

### 3. เพิ่ม Assets ใหม่

```typescript
// src/config/themes.ts
assets: {
  logo: '/image/newtheme-logo.png',
  backgroundImage: '/image/newtheme-bg.jpg',
  favicon: '/image/newtheme-favicon.ico',
}
```

## 🚀 การ Deploy

### 1. Build สำหรับ Production
```bash
npm run build
```

### 2. Deploy ไปยัง Multiple Domains
- **heng36.party** → ใช้ธีม HENG36
- **max56.party** → ใช้ธีม MAX56

### 3. การตั้งค่า DNS
```
heng36.party → your-server.com
max56.party → your-server.com
```

## 🔍 Debug & Monitoring

### 1. Development Mode
- ระบบจะแสดง debug info ใน console
- มี ThemeInfo component แสดงข้อมูลธีมปัจจุบัน
- มี ThemeTest page สำหรับทดสอบ

### 2. Production Mode
- ไม่มี debug info
- ระบบทำงานแบบ silent
- Performance optimized

## 📊 Performance

- **CSS Variables**: ใช้ CSS custom properties สำหรับ performance ที่ดี
- **Lazy Loading**: Theme components โหลดแบบ lazy
- **Caching**: Theme config ถูก cache ใน memory
- **Minimal Re-renders**: ใช้ React.memo และ useMemo

## 🛡️ Security

- **Domain Validation**: ตรวจสอบโดเมนที่ถูกต้อง
- **XSS Protection**: Sanitize ข้อมูลก่อนแสดง
- **CSP Headers**: Content Security Policy สำหรับ assets

## 🔮 Roadmap

- [ ] เพิ่มธีมใหม่ (Blue, Purple, etc.)
- [ ] รองรับ Dark Mode
- [ ] Theme Editor สำหรับ Admin
- [ ] A/B Testing สำหรับธีม
- [ ] Analytics สำหรับธีมที่ใช้

---

## 📞 Support

หากมีปัญหาหรือต้องการความช่วยเหลือ:
- เปิด Issue ใน GitHub
- ติดต่อทีมพัฒนา
- ดู Documentation เพิ่มเติม
