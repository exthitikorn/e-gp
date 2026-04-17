## คู่มือตั้งเวลา Ingest e-GP อัตโนมัติ (00:00)

> ระบบเป้าหมาย: GNU/Linux + `cron`  
> เป้าหมาย: เรียก `GET /api/egp/announcements/ingest` อัตโนมัติวันละ 1 ครั้ง  
> เวลาอ้างอิงในเอกสารนี้: เวลาไทย (Asia/Bangkok)

---

## 1) เตรียมค่าที่ต้องใช้

กำหนดข้อมูล 2 ค่าให้พร้อมก่อน:

- `BASE_URL` เช่น `https://your-domain`
- `EGP_INGEST_SECRET` (ต้องตรงกับค่าที่ระบบ backend ใช้ตรวจ token)

ตัวอย่างในไฟล์ `.env`:

```env
EGP_INGEST_SECRET=YOUR_SECRET_HERE
```

ตัวอย่าง URL ที่ endpoint จะถูกเรียกจริง:

```text
https://your-domain/api/egp/announcements/ingest?token=YOUR_SECRET_HERE
```

---

## 2) ติดตั้งเครื่องมือที่จำเป็น

```bash
sudo apt update
sudo apt install curl -y
```

ตรวจสอบว่าใช้งานได้:

```bash
curl --version
```

---

## 3) ตั้งค่าแบบปลอดภัยด้วยสคริปต์ (แนะนำ)

เพื่อหลีกเลี่ยงการใส่ secret ตรง ๆ ใน crontab ให้สร้างสคริปต์แยก:

1. สร้างโฟลเดอร์และไฟล์สคริปต์

```bash
sudo mkdir -p /opt/egp
sudo nano /opt/egp/run_ingest.sh
```

2. วางโค้ดนี้ในไฟล์ `/opt/egp/run_ingest.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_URL="https://your-domain"
INGEST_SECRET="YOUR_SECRET_HERE"
LOG_FILE="/var/log/egp_ingest.log"

curl -fsS "${BASE_URL}/api/egp/announcements/ingest?token=${INGEST_SECRET}" >> "${LOG_FILE}" 2>&1
```

3. ตั้ง permission ให้รันได้และจำกัดการอ่านไฟล์

```bash
sudo chmod 700 /opt/egp/run_ingest.sh
sudo chown root:root /opt/egp/run_ingest.sh
```

> ถ้าต้องการความปลอดภัยเพิ่ม: อ่าน secret จากไฟล์ที่ permission เข้มงวดแทนการเขียนค่าไว้ในสคริปต์

---

## 4) เพิ่ม Cron Job

เปิด crontab:

```bash
crontab -e
```

เพิ่มบรรทัดนี้:

```bash
0 0 * * * /opt/egp/run_ingest.sh
```

ความหมาย:

- `0 0 * * *` = รันทุกวันเวลา 00:00
- เรียกสคริปต์ที่รวม logic และ logging ไว้แล้ว

บันทึกไฟล์และออกจาก editor ตามที่ใช้งาน

---

## 5) ตรวจสอบว่าตั้ง cron สำเร็จ

```bash
crontab -l
```

ควรเห็นบรรทัด:

```bash
0 0 * * * /opt/egp/run_ingest.sh
```

---

## 6) ทดสอบก่อนใช้งานจริง

ทดสอบสคริปต์ทันที:

```bash
/opt/egp/run_ingest.sh
```

ตรวจ log:

```bash
tail -n 50 /var/log/egp_ingest.log
```

ผลลัพธ์ที่คาดหวัง (ตัวอย่าง):

```json
{
  "created": 10,
  "updated": 5,
  "totalFromRss": 15
}
```

---

## 7) Timezone ให้ตรงเวลาไทย

ตรวจ timezone ของเครื่อง:

```bash
timedatectl
```

- ถ้าเป็น `Asia/Bangkok` อยู่แล้ว: ใช้ `0 0 * * *` ได้ตรงเวลาไทย
- ถ้าเครื่องเป็น `UTC` แต่ต้องการให้ตรงเวลาไทย:
  - 00:00 ICT = 17:00 UTC (วันก่อนหน้า)
  - cron ที่ใช้คือ:

```bash
0 17 * * *
```

---

## 8) Troubleshooting ที่พบบ่อย

- **เรียกไม่ได้ (401/403):** token ไม่ตรงกับฝั่ง backend
- **เรียกไม่ได้ (5xx):** backend ล่ม, DB มีปัญหา, หรือ timeout
- **cron ไม่ทำงาน:** ตรวจ service ด้วย `systemctl status cron` (บาง distro ชื่อ `crond`)
- **ไม่มี log:** ตรวจ permission ของ `/var/log/egp_ingest.log` และสิทธิ์ผู้รัน cron

---

## 9) Security Checklist ก่อนขึ้น Production

- ไม่ commit ค่า secret ลง Git
- จำกัดสิทธิ์ไฟล์สคริปต์ (`chmod 700`) และ owner ให้ชัดเจน
- จำกัดการเข้าถึง endpoint ด้วย firewall / reverse proxy (allow เฉพาะแหล่งที่ไว้ใจ)
- ตรวจ log เป็นระยะ และตั้ง alert เมื่อเจอ error ซ้ำ ๆ

