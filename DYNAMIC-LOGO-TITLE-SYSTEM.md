# 🏷️ Dynamic Logo & Title System

ระบบโลโก้และชื่อแบรนด์ที่เปลี่ยนตามธีมอัตโนมัติ

## 🎯 ฟีเจอร์หลัก

### ✨ Dynamic Logo Component
- **เปลี่ยนโลโก้ตามธีม**: HENG36 → MAX56
- **หลายรูปแบบ**: Horizontal, Vertical, Icon Only
- **Gradient Text**: ชื่อแบรนด์แบบไล่สีตามธีม
- **Responsive**: ปรับขนาดตามหน้าจอ

### 📝 Dynamic Title Component
- **เปลี่ยนชื่อตามธีม**: HENG36 PARTY → MAX56 GAME
- **หลายรูปแบบ**: Gradient, Solid, Outline
- **Subtitle Support**: แสดงคำอธิบายเพิ่มเติม
- **Customizable**: ปรับระดับ heading และสไตล์

## 🛠️ การใช้งาน

### 1. Dynamic Logo

```tsx
import DynamicLogo from '../components/DynamicLogo'

// แบบ Horizontal (default)
<DynamicLogo 
  width={60} 
  height={60} 
  textSize="lg" 
  variant="horizontal" 
/>

// แบบ Vertical
<DynamicLogo 
  width={60} 
  height={60} 
  textSize="lg" 
  variant="vertical" 
/>

// แบบ Icon Only
<DynamicLogo 
  width={60} 
  height={60} 
  variant="icon-only" 
/>
```

### 2. Dynamic Title

```tsx
import DynamicTitle from '../components/DynamicTitle'

// แบบ Gradient (default)
<DynamicTitle 
  level={1} 
  showSubtitle={true} 
  centered={true} 
  variant="gradient" 
/>

// แบบ Solid
<DynamicTitle 
  level={2} 
  variant="solid" 
/>

// แบบ Outline
<DynamicTitle 
  level={3} 
  variant="outline" 
/>
```

## 🎨 Theme-Based Branding

### HENG36 Theme (heng36.party)
- **Title**: "HENG36 PARTY"
- **Subtitle**: "ระบบจัดการเกม HENG36"
- **Colors**: เขียว (#10B981) + ส้ม (#F59E0B)
- **Logo**: logo-heng36.png

### MAX56 Theme (max56.party)
- **Title**: "MAX56 GAME"
- **Subtitle**: "ระบบจัดการเกม MAX56"
- **Colors**: แดง (#DC2626) + น้ำตาลแดง (#7C2D12)
- **Logo**: logo-max56.png

## 🔧 Props & Options

### DynamicLogo Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | number | 40 | ความกว้างของโลโก้ |
| `height` | number | 40 | ความสูงของโลโก้ |
| `className` | string | '' | CSS classes เพิ่มเติม |
| `showText` | boolean | true | แสดงชื่อแบรนด์ |
| `textSize` | 'sm'\|'md'\|'lg'\|'xl' | 'md' | ขนาดตัวอักษร |
| `variant` | 'horizontal'\|'vertical'\|'icon-only' | 'horizontal' | รูปแบบการแสดง |

### DynamicTitle Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `level` | 1\|2\|3\|4\|5\|6 | 1 | ระดับ heading |
| `className` | string | '' | CSS classes เพิ่มเติม |
| `showSubtitle` | boolean | false | แสดงคำอธิบาย |
| `centered` | boolean | false | จัดกึ่งกลาง |
| `variant` | 'gradient'\|'solid'\|'outline' | 'gradient' | รูปแบบการแสดง |

## 🎭 Styling Options

### Gradient Variants
```tsx
// Gradient (default) - ไล่สีตามธีม
<DynamicTitle variant="gradient" />

// Solid - สีเดียวตามธีม
<DynamicTitle variant="solid" />

// Outline - เฉพาะขอบตามธีม
<DynamicTitle variant="outline" />
```

### Layout Variants
```tsx
// Horizontal - แนวนอน (default)
<DynamicLogo variant="horizontal" />

// Vertical - แนวตั้ง
<DynamicLogo variant="vertical" />

// Icon Only - เฉพาะไอคอน
<DynamicLogo variant="icon-only" />
```

## 🚀 การทดสอบ

### 1. ทดสอบใน Browser
- เปิด `http://localhost:5174/theme-test`
- ดูการเปลี่ยนโลโก้และชื่อแบบ real-time
- ทดสอบรูปแบบต่างๆ ของ Logo และ Title

### 2. ทดสอบการเปลี่ยนธีม
```javascript
// ใน Browser Console
import { useTheme } from './src/contexts/ThemeContext'

// เปลี่ยนเป็นธีม MAX56
setTheme('max56')

// เปลี่ยนเป็นธีม HENG36
setTheme('heng36')
```

### 3. ทดสอบ Responsive
- ปรับขนาดหน้าต่าง browser
- ดูการปรับตัวของ Logo และ Title
- ทดสอบใน mobile view

## 📱 Responsive Design

### Mobile (< 768px)
- Logo ขนาดเล็กลง
- Title ขนาดเล็กลง
- Layout แนวตั้ง

### Tablet (768px - 1024px)
- Logo ขนาดปานกลาง
- Title ขนาดปานกลาง
- Layout ผสม

### Desktop (> 1024px)
- Logo ขนาดใหญ่
- Title ขนาดใหญ่
- Layout แนวนอน

## 🎨 Customization

### 1. เพิ่มธีมใหม่
```typescript
// src/config/themes.ts
export const themes: Record<ThemeName, ThemeConfig> = {
  // ... existing themes
  newtheme: {
    name: 'newtheme',
    displayName: 'NEW THEME',
    branding: {
      title: 'NEW THEME TITLE',
      subtitle: 'คำอธิบายธีมใหม่',
      description: 'รายละเอียดธีมใหม่',
    },
    // ... other config
  }
}
```

### 2. เพิ่มรูปแบบใหม่
```tsx
// เพิ่ม variant ใหม่ใน DynamicTitle
const getTitleStyle = () => {
  switch (variant) {
    case 'neon':
      return {
        color: colors.primary,
        textShadow: `0 0 10px ${colors.primary}`,
        filter: 'brightness(1.2)'
      }
    // ... other cases
  }
}
```

### 3. เพิ่ม Animation
```css
/* เพิ่ม animation สำหรับการเปลี่ยนธีม */
.dynamic-logo {
  transition: all 0.3s ease;
}

.dynamic-title {
  transition: all 0.3s ease;
}
```

## 🔍 Debug & Monitoring

### 1. ตรวจสอบ Theme Context
```javascript
// ใน Browser Console
const { theme, themeName, branding } = useTheme()
console.log('Current theme:', themeName)
console.log('Branding:', branding)
```

### 2. ตรวจสอบ CSS Variables
```javascript
// ใน Browser Console
const root = document.documentElement
const computedStyle = getComputedStyle(root)
console.log('Theme colors:', {
  primary: computedStyle.getPropertyValue('--theme-primary'),
  secondary: computedStyle.getPropertyValue('--theme-secondary'),
})
```

### 3. ตรวจสอบ Image Loading
```javascript
// ใน Browser Console
const logo = document.querySelector('img[alt*="HENG36"], img[alt*="MAX56"]')
console.log('Logo src:', logo?.src)
console.log('Logo loaded:', logo?.complete)
```

## 📊 Performance

### 1. Image Optimization
- ใช้ WebP format สำหรับรูปภาพใหม่
- Optimize ขนาดไฟล์ก่อนใช้งาน
- ใช้ lazy loading สำหรับรูปภาพใหญ่

### 2. CSS Optimization
- ใช้ CSS variables สำหรับ dynamic colors
- ใช้ transform แทน position changes
- ใช้ will-change สำหรับ animations

### 3. Bundle Size
- ใช้ dynamic imports สำหรับ components
- Tree shaking สำหรับ unused code
- Code splitting สำหรับ themes

## 🛡️ Best Practices

### 1. การตั้งชื่อไฟล์
- ใช้รูปแบบ: `logo-{theme}.png`
- ตัวอย่าง: `logo-heng36.png`, `logo-max56.png`

### 2. การจัดการขนาดไฟล์
- Logo: 60x60px สำหรับ mobile, 80x80px สำหรับ desktop
- Title: responsive font sizes
- Images: WebP format เมื่อเป็นไปได้

### 3. การ Cache
- รูปภาพจะถูก cache โดย browser
- ใช้ versioning สำหรับการอัปเดต
- ใช้ CDN สำหรับ production

---

## 📞 Support

หากมีปัญหาหรือต้องการความช่วยเหลือ:
- ตรวจสอบ console logs
- ดู Network tab ใน DevTools
- ทดสอบใน `/theme-test` page
- ติดต่อทีมพัฒนา
