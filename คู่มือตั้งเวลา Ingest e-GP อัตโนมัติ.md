## ตั้งเวลา Ingest e-GP อัตโนมัติทุกวัน 00:30 และ 12:30 (GNU/Linux + cron)

> ระบบ: GNU/Linux 18.x  
> จุดประสงค์: ให้ยิงเรียก `GET /api/egp/announcements/ingest` อัตโนมัติวันละ 2 ครั้ง

---

## 1. เตรียมค่า Environment และ URL

1. ตรวจสอบให้แน่ใจว่าใน `.env` มีค่า:

   ```env
   EGP_INGEST_SECRET=YOUR_SECRET_HERE
   ```

2. สมมติว่าโดเมนโปรดักชันคือ:

   ```text
   https://your-domain
   ```

3. URL ที่จะให้ cron เรียกคือ:

   ```text
   https://your-domain/api/egp/announcements/ingest?token=YOUR_SECRET_HERE
   ```

   > แทนที่ `YOUR_SECRET_HERE` ด้วยค่าจริงจาก `EGP_INGEST_SECRET`

---

## 2. ติดตั้ง curl (ถ้ายังไม่มี)

```bash
sudo apt update
sudo apt install curl -y
```

---

## 3. สร้าง/แก้ไข Cron Job

1. เปิด `crontab` ของ user ที่ต้องการให้รัน (ควรเป็น user เดียวกับที่รันแอป หรือ user service):

   ```bash
   crontab -e
   ```

2. เพิ่มบรรทัดต่อไปนี้ (ปรับโดเมนและ secret ให้ตรงกับของจริง):

   ```bash
   30 0,12 * * * curl -sS "https://your-domain/api/egp/announcements/ingest?token=YOUR_SECRET_HERE" >> /var/log/egp_ingest.log 2>&1
   ```

   ความหมาย:

   - `30 0,12 * * *` = รันเวลา **00:30** และ **12:30** ของทุกวัน
   - `curl -sS "URL"` = ยิง HTTP GET ไปที่ ingest endpoint
   - `>> /var/log/egp_ingest.log 2>&1` = เขียนทั้ง stdout และ stderr ลงไฟล์ log

3. บันทึกไฟล์แล้วออกจาก editor (`:wq` สำหรับ vim, `Ctrl+X` → `Y` → `Enter` สำหรับ nano)

---

## 4. ตรวจสอบว่า Cron ถูกบันทึกแล้ว

รันคำสั่ง:

```bash
crontab -l
```

ตรวจสอบว่ามีบรรทัด:

```bash
30 0,12 * * * curl -sS "https://your-domain/api/egp/announcements/ingest?token=YOUR_SECRET_HERE" >> /var/log/egp_ingest.log 2>&1
```

---

## 5. ทดสอบการเรียก Ingest ด้วยตนเอง

1. ทดสอบเรียกจาก server ตรง ๆ หนึ่งครั้ง:

   ```bash
   curl -v "https://your-domain/api/egp/announcements/ingest?token=YOUR_SECRET_HERE"
   ```

2. ตรวจสอบผลลัพธ์ควรเป็น JSON ลักษณะ:

   ```json
   {
     "created": 10,
     "updated": 5,
     "totalFromRss": 15
   }
   ```

3. ตรวจสอบ log:

   ```bash
   tail -n 50 /var/log/egp_ingest.log
   ```

---

## 6. หมายเหตุเรื่อง Timezone

- ถ้า server ตั้ง timezone เป็น **Asia/Bangkok (UTC+7)** อยู่แล้ว  
  - Cron expression `30 0,12 * * *` จะหมายถึง 00:30 และ 12:30 ตามเวลาไทยตรง ๆ
- ถ้า server เป็น **UTC** แต่ต้องการให้ตรงเวลาไทย:
  - 00:30 เวลาไทย = 17:30 (วันก่อนหน้า) UTC
  - 12:30 เวลาไทย = 05:30 UTC
  - ตัวอย่าง cron (ถ้าเครื่องเป็น UTC):

    ```bash
    30 17,5 * * * curl -sS "https://your-domain/api/egp/announcements/ingest?token=YOUR_SECRET_HERE" >> /var/log/egp_ingest.log 2>&1
    ```

---

## 7. Security Best Practices

- อย่า hard‑code secret ลงใน script หรือแชร์ไฟล์ crontab ให้คนนอก
- ถ้ามี reverse proxy / firewall:
  - จำกัด IP ที่อนุญาตให้เรียก URL นี้ (เช่น ให้เรียกได้จาก IP ของ server ภายในเท่านั้น)
- ตรวจสอบ log เป็นระยะ:
  - ดู error ที่เกิดบ่อย ๆ (เช่น 401, 500) แล้วแก้ไขที่ระบบ ingest หรือ network

