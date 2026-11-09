# Enterprise IT Asset Management & PM Backend API (OWASP AppSec Hardened)

Production-ready Backend API serving both the **C# Windows Background Agent** and the **IT Admin Web Portal / Mobile QR Code Scanner**, hardened against **OWASP API Security Top 10** vulnerabilities.

---

## 🛡️ มาตรการความปลอดภัยขั้นสูง (The 6 AppSec Security Layers)

### 1. Strict Input Validation & Payload Size Limits (Anti-DoS & Anti-Pollution)
- กำหนด Schema Validation ด้วย **`zod`** ครอบคลุมทุก Request Body, Query Params, และ URL Params
- ตัดฟิลด์แปลกปลอมที่ไม่ได้นิยามทิ้งอัตโนมัติ (`.strip()`) ป้องกัน JSON Parameter Pollution
- กำหนดขนาด Payload Body เจาะจงตามหน้าที่:
  - `/api/v1/agent/inventory`: จำกัดสูงสุด **256 KB** (จำกัดโปรแกรมไม่เกิน 500 รายการ และจอภาพไม่เกิน 10 ตัว ป้องกัน JSONB Bombs)
  - `/api/v1/agent/telemetry`: จำกัดสูงสุด **32 KB**
  - `/api/v1/pm/submit`: จำกัดสูงสุด **2 MB** (รองรับรูปภาพลายเซ็นดิจิทัล Base64 ขนาดไม่เกิน 100 KB)

### 2. Stored XSS & Injection Prevention (Sanitization Pipeline)
- ฟังก์ชัน **`sanitizeString`** ทำการกำจัด Tag HTML, Script wrappers, Null bytes (`\0`), และ Non-printable control characters ออกจากทุกข้อความที่ส่งมาจาก Agent (เช่น `hostname`, `installedSoftware`, `assignedUser`) ก่อนจัดเก็บลงฐานข้อมูล ป้องกัน Stored XSS เมื่อแสดงผลบน Dashboard ของ IT Admin
- ทุกคำสั่ง SQL ใช้ **Parameterized Queries (`$1, $2, ...`) 100%** ไร้การต่อ String ป้องกัน SQL Injection อย่างสิ้นเชิง

### 3. Agent Authentication & Anti-Spoofing / Anti-Replay
- **Timing-Safe Pre-Shared Key:** ตรวจสอบ `X-Api-Key` ด้วย `crypto.timingSafeEqual` ในแบบ Constant-time ป้องกัน Side-channel Timing Attacks
- **Anti-Replay Protection:** ตรวจสอบ Header `X-Timestamp` หากเวลาคลาดเคลื่อนเกิน **5 นาที** (300,000 ms) จะปฏิเสธการเชื่อมต่อทันที
- **HMAC-SHA256 Payload Verification:** หากส่ง Header `X-Signature` เข้ามา ระบบจะคำนวณ Hash ของ `timestamp + "." + rawBody` และเปรียบเทียบในแบบ Constant-time ป้องกันการดักจับและแก้ไขข้อมูลกลางทาง (Man-in-the-Middle)

### 4. Role-Based Access Control (RBAC) & Admin Auth Hardening
- กำหนดสิทธิ์ผู้ใช้งานเป็น 3 ลำดับขั้น:
  - **`VIEWER`**: ดู Dashboard และรายงานความเร่งด่วนได้อย่างเดียว
  - **`TECHNICIAN`**: สแกน QR Code, ยืนยันการตรวจนับพัสดุ (`/audit/*`) และส่งบันทึกการทำ PM (`/pm/*`)
  - **`ADMIN`**: มีสิทธิ์เต็ม รวมถึงการผูกทะเบียนทรัพย์สิน (`/admin/assets/:id/bind`) และกดยอมรับประวัติฮาร์ดแวร์เปลี่ยนแปลง
- **Signature Image Validation:** ตรวจสอบรูปภาพลายเซ็น `user_signoff_signature` ด้วย Regex `^data:image/(png|jpeg);base64,...` และจำกัดขนาดของรูปไม่เกิน **100 KB**

### 5. Granular Tiered Rate Limiting & HTTP Security Headers
- **`helmet()`**: เปิดใช้ Content Security Policy (CSP), HTTP Strict Transport Security (HSTS) อายุ 1 ปี
- **`cors()`**: อนุญาตเฉพาะ Origin ของระบบภายในที่ระบุใน Environment Variables (ไม่อนุญาต Wildcard `*`)
- **Tiered Rate Limiting**:
  - Telemetry Heartbeat: อนุญาตสูงสุด 15 requests / 5 นาที ต่อ IP
  - Full Inventory Sync: อนุญาตสูงสุด 10 requests / 1 ชั่วโมง ต่อ IP
  - Audit & PM Endpoints: สูงสุด 100 requests / 15 นาที
  - Auth / QR Scanner: สูงสุด 20 requests / 15 นาที ป้องกันการ Brute-force

### 6. Safe Error Handling & Security Audit Logging
- **`safeErrorHandler`**: ไม่เปิดเผย Stack Traces, โครงสร้างตาราง หรือ Internal Database Exception ออกไปใน HTTP Response เมื่ออยู่ใน Production
- **`logAdminAudit`**: บันทึก Log การเปลี่ยนแปลงข้อมูลสำคัญของระบบ (การผูก Asset Tag, การยอมรับประวัติฮาร์ดแวร์ถูกสับเปลี่ยน) พร้อมระบุ `admin_user_id`, วันเวลา, และ `sourceIp` ลงใน Log กลางสำหรับส่งต่อ SIEM

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```
c:\Users\meetingroom\Desktop\Programs-iBell\BackendAPI\
│
├── package.json                        # Dependencies (express, pg, zod, helmet, cors, jsonwebtoken, rate-limit)
├── tsconfig.json                       # การตั้งค่า TypeScript (ES2022, Strict mode, CommonJS)
├── .env.example                        # ตัวอย่าง Configuration สำหรับฐานข้อมูลและ Secret Keys
├── init_schema.sql                     # PostgreSQL 16+ DDL Schema พร้อม GIN Indexes และ Views
├── README.md                           # คู่มือฉบับสมบูรณ์
│
└── src/
    ├── config.ts                       # Environment Variables และ Agent Release Manifest
    ├── db.ts                           # pg.Pool Connection Pool และ Helper withTransaction
    ├── server.ts                       # Entrypoint: Express App, Helmet CSP, Strict CORS, Safe Error Handler
    │
    ├── schemas/
    │   └── validationSchemas.ts        # Zod Schemas + XSS Sanitizer สำหรับทุก Endpoint
    │
    ├── middleware/
    │   └── securityMiddleware.ts       # HMAC Verification, Anti-Replay, RBAC Guard, Rate Limiters & Error Handler
    │
    ├── services/
    │   └── tamperDetectionService.ts   # ตรวจจับการสับเปลี่ยนฮาร์ดแวร์ (RAM ลด, จอสลับ S/N, เมนบอร์ดเปลี่ยน)
    │
    ├── controllers/
    │   ├── agentController.ts          # รับ Inventory, Heartbeat Telemetry, Version Update
    │   ├── auditAndPmController.ts     # Mobile QR Scan, บันทึกการตรวจนับพัสดุ, Pre-fill & บันทึก PM
    │   └── adminController.ts          # ผูก Asset Tag, ดูรายงาน PM Priority Queue & Audit Views
    │
    └── routes/
        ├── agentRoutes.ts              # Route: /api/v1/agent/* (256KB/32KB Limits, HMAC, Anti-Replay)
        ├── auditRoutes.ts              # Route: /api/v1/audit/* (RBAC: TECHNICIAN)
        ├── pmRoutes.ts                 # Route: /api/v1/pm/* (RBAC: TECHNICIAN, 2MB Limit for Signature)
        └── adminRoutes.ts              # Route: /api/v1/admin/* (RBAC: ADMIN / VIEWER)
```

---

## 🛠️ วิธีการติดตั้งและรันระบบ (Setup Guide)

```bash
cd "C:\Users\meetingroom\Desktop\Programs-iBell\BackendAPI"

# 1. ติดตั้ง Dependencies (รวม zod)
npm install

# 2. ตั้งค่า Environment Variables
cp .env.example .env

# 3. รันเซิร์ฟเวอร์
npm run dev
```
