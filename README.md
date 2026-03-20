## e-gp (Next.js + Prisma + MySQL)
แอปสำหรับ “เก็บข้อมูลโครงการและประกาศ” จากระบบ e-GP (ผ่าน RSS) แล้วจัดเก็บลงฐานข้อมูลเพื่อค้นหาและดูรายละเอียดย้อนหลังได้

หน้าเว็บหลัก:
- รายการโครงการและประกาศ: `/egp/announcements`
- รายละเอียดโครงการ: `/egp/announcements/[projectId]`

## ฟีเจอร์หลัก
- Ingest ข้อมูลจาก e-GP RSS (ทุกประเภทประกาศที่กำหนดในโค้ด)
- อัปเดต/เพิ่มข้อมูลแบบ upsert และ parse PDF แบบ best-effort
- ค้นหาโครงการ/ประกาศด้วย keyword และตัวกรองต่างๆ ผ่าน API

## เทคโนโลยี
- Next.js 16 (App Router)
- Prisma Client + MySQL
- TailwindCSS

## Prerequisites
- Node.js
- MySQL (รองรับ Prisma schema)

## ตั้งค่า Environment (`.env`)
สร้างไฟล์ `.env` ที่รากโปรเจกต์ (ระดับเดียวกับ `package.json`) โดยอย่างน้อยควรมี:

```env
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/e-gp"
EGP_DEPTSUB_ID="310000110000331"
EGP_DEPT_ID="..."              # ใช้สร้าง URL ของ RSS
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# ไม่ใส่ก็ได้ (แต่ endpoint จะไม่กันการเรียกอัตโนมัติ)
# ถ้าใส่ ต้องส่ง token ในการเรียก ingest
# EGP_INGEST_SECRET="YOUR_SECRET_HERE"
```

หมายเหตุด้านความปลอดภัย:
- `EGP_INGEST_SECRET` เป็นความลับ ห้าม commit ไฟล์ `.env` ขึ้น Git

## ติดตั้งและรันโปรเจกต์ (Local)
```bash
npm install

# สร้าง/อัปเดต schema
npm run prisma:migrate

# เริ่ม dev server
npm run dev
```
เปิดเว็บที่ `http://localhost:3000`

## การใช้งาน Ingest
1. เข้า `/egp/announcements`
2. กดปุ่ม `ดึงข้อมูลจาก e-GP`
3. ระบบจะยิง `GET /api/egp/announcements/ingest` และแสดงผลจำนวน `created/updated`

> ถ้า `EGP_INGEST_SECRET` ถูกตั้งไว้ ระบบจะตรวจสอบ `token` ที่ส่งมาด้วยใน query string

## ตั้งเวลา Ingest อัตโนมัติ (Cron)
ดูรายละเอียดได้ที่ไฟล์นี้ในโปรเจกต์:
- `คู่มือตั้งเวลา Ingest e-GP อัตโนมัติ.md`

สรุปแนวคิด:
- เรียก `GET /api/egp/announcements/ingest` วันละ 2 ครั้ง
- ถ้าตั้ง `EGP_INGEST_SECRET` จะต้องใส่ `?token=...`

## โครงสร้างข้อมูล (Prisma)
โมเดลหลักใน `prisma/schema.prisma`:
- `EgpProject` (ตารางโครงการ)
- `EgpAnnouncement` (ตารางประกาศ) เชื่อมกับ `EgpProject` ด้วย `projectId`

## API ที่ใช้งานหลัก
- `GET /api/egp/projects/search`
  - query: `q`, `projectNumber`, `methodId`, `status`, `page`, `pageSize`
- `GET /api/egp/announcements/search`
  - query: `startDate`, `endDate`, `q`, `projectNumber`, `methodId`, `status`, `page`, `pageSize`
- `GET /api/egp/announcements/ingest`
  - query: `token` (จำเป็นเมื่อ `EGP_INGEST_SECRET` ถูกตั้งค่า)
- `GET /api/egp/announcements/parse-pdf?id=...`
  - ใช้ parse/ดึงข้อมูลจากไฟล์ PDF ของ announcement ที่มีอยู่ใน DB
- `GET /api/egp/announcements`
  - ใช้ fetch จาก e-GP RSS แบบตรงๆ
  - query: `deptId`, `deptsubId`, `anounceType`, `methodId`, `announceDate`

## สคริปต์ที่มีในโปรเจกต์
- `npm run dev` (Next dev)
- `npm run build` (prisma generate + next build)
- `npm run start` (next start)
- `npm run prisma:migrate` (ย้าย/อัปเดต schema)
- `npm run lint` (eslint)
