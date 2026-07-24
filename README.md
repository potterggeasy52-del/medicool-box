# MediCool Box

เว็บ PWA สำหรับต้นแบบ Smart Cold Chain Transport System เชื่อมข้อมูลสดจาก
Firebase Realtime Database ที่โหนด `/MediCoolBox`

## ฟังก์ชันหลัก

- Dashboard: อุณหภูมิ สถานะการทำความเย็น GPS ดาวเทียม Wi-Fi และรหัสอุปกรณ์
- Delivery: กราฟอุณหภูมิย้อนหลัง ตำแหน่ง และปุ่มเปิด Google Maps
- QR Scanner: อ่าน QR ผ่านกล้องด้วย `jsQR` เพื่อรองรับเบราว์เซอร์มือถือทั่วไป
- Notifications: แจ้งเตือนตามข้อมูลจริงและสถานะการขนส่ง
- Profile: รายละเอียดต้นแบบและสถานะการเชื่อมต่อ
- PWA: ติดตั้งบนหน้าจอหลักได้เมื่อเปิดผ่าน HTTPS

## รันบนเครื่อง

```text
pnpm install
pnpm dev
```

## QR สำหรับ BOX-001

ตัวสแกนรองรับทั้ง QR ที่เก็บข้อความ `BOX-001` โดยตรง และ QR ที่เก็บ URL ของเว็บ
เช่น:

```text
https://potterggeasy52-del.github.io/medicool-box/?box=BOX-001
```

เมื่อสแกนสำเร็จ เว็บจะแสดงข้อมูลกล่องและปุ่มเริ่มขนส่งหรือยืนยันส่งมอบตามสถานะ
ปัจจุบัน หากกล้องใช้งานไม่ได้ยังมีปุ่มโหมดสาธิตสำหรับนำเสนอ

> กล้องทำงานได้เฉพาะบน HTTPS หรือ localhost และผู้ใช้ต้องอนุญาตสิทธิ์กล้อง

## Firebase

เว็บอ่านข้อมูลจาก:

```text
https://medicoolbox-default-rtdb.asia-southeast1.firebasedatabase.app/MediCoolBox.json
```

Realtime Database Rules ต้องอนุญาตให้อ่านข้อมูล หากเว็บขึ้น “ข้อมูลล่าสุด”
ให้ตรวจ Rules, Wi-Fi และตรวจว่า ESP32 ยังส่งข้อมูลอยู่

## ข้อจำกัด

ระบบนี้เป็นต้นแบบเพื่อการศึกษา ยังไม่ใช่อุปกรณ์การแพทย์ที่ผ่านการรับรอง
