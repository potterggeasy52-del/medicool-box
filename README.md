# MediCool Box

เว็บ PWA สำหรับต้นแบบ Smart Cold Chain Transport System เชื่อมข้อมูลสดจาก Firebase Realtime Database ที่โหนด `/MediCoolBox`

## ฟังก์ชัน

- Dashboard: temperature, status, cooling, GPS, satellites, Wi-Fi และ device
- Delivery: กราฟอุณหภูมิ ตำแหน่ง และปุ่มเปิด Google Maps
- QR Scanner: ใช้กล้องในเบราว์เซอร์ที่รองรับ BarcodeDetector พร้อมปุ่มทดสอบ `BOX-001`
- Notifications: สร้างรายการแจ้งเตือนตามสถานะจริง
- Profile: รายละเอียดต้นแบบและสถานะการเชื่อมต่อ
- PWA: ติดตั้งบนหน้าจอหลักได้เมื่อเปิดผ่าน HTTPS

## รันบนเครื่อง

```text
pnpm install
pnpm dev
```

เปิด URL ที่แสดงในหน้าต่างคำสั่ง

## ข้อมูล Firebase

เว็บอ่านข้อมูลจาก:

```text
https://medicoolbox-default-rtdb.asia-southeast1.firebasedatabase.app/MediCoolBox.json
```

Realtime Database Rules ต้องอนุญาตให้อ่านข้อมูลได้ หากเว็บขึ้น “ข้อมูลล่าสุด” ให้ตรวจ Rules, Wi-Fi และดูว่า ESP32 ยังส่งข้อมูลอยู่

## หมายเหตุ QR

สิทธิ์กล้องทำงานเมื่อเว็บเปิดผ่าน HTTPS หรือ localhost เท่านั้น QR สำหรับสาธิตควรเก็บข้อความ `BOX-001`

## ข้อจำกัด

ระบบนี้เป็นต้นแบบเพื่อการศึกษา ยังไม่ใช่อุปกรณ์การแพทย์ที่ผ่านการรับรอง
