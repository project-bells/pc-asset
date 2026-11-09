# Enterprise IT Asset Management & Endpoint Monitoring Agent (.NET 8)

Production-ready **C# .NET 8 Worker Service** designed to run as a **Windows Background Service** (`LocalSystem`) with strict enforcement of **Security, Privacy (PDPA), and Zero-Impact Performance**.

---

## 🛡️ สถาปัตยกรรมความปลอดภัยและประสิทธิภาพ 4 เสาหลัก (The 4 Pillars)

### 1. Network Security & Anti-Data Exfiltration (Strict Egress Control)
- **Hardcoded Egress Allowlist ([`SecurityValidator.cs`](file:///c:/Users/meetingroom/Desktop/Programs-iBell/Services/Security/SecurityValidator.cs))**: ตรวจสอบ `BackendBaseUrl` ทุกครั้งก่อนเปิดการเชื่อมต่อ อนุญาตเฉพาะโดเมนภายใน (`*.company.local`, `*.internal`, `*.corp`) หรือ Private IP Ranges (RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` และ Loopback) หากปลายทางเป็น External Host ทั่วไป จะระงับการส่งทันทีด้วย `SecurityException`
- **TLS 1.2 / TLS 1.3 Only**: บังคับโปรโตคอลการเข้ารหัสระดับสูงผ่าน `SocketsHttpHandler`
- **Certificate Pinning**: รองรับการตรวจสอบ Thumbprint ของ Root CA หรือ Leaf Certificate เพื่อป้องกันการดักข้อมูล (MitM)
- **Zero Third-Party Telemetry**: ใช้เฉพาะไลบรารีทางการของ `System.*` และ `Microsoft.Extensions.*` ปราศจาก SDK ภายนอก

### 2. Zero-Impact System Performance (Resource Throttling)
- **Process Scheduling Priority**: ตั้งค่า `ProcessPriorityClass.BelowNormal` ตั้งแต่เปิด Service เพื่อให้ Windows จัดสรรทรัพยากรให้แอปพลิเคชันธุรกิจและผู้ใช้งานก่อนเสมอ
- **WMI Query Timeouts**: กำหนด `System.Management.EnumerationOptions` ให้มี `Timeout = 5 วินาที` และ `ReturnImmediately = true` ทุกจุด ป้องกันไม่ให้การสืบค้น WMI ค้างหรือทำให้ระบบชะงัก
- **Startup Jitter**: สุ่มหน่วงเวลาตอนเปิดเครื่อง (Random Jitter 30-180 วินาที) ก่อนเริ่มสแกน Inventory ครั้งแรก เพื่อหลีกเลี่ยงการแย่ง I/O และ CPU ในช่วง Windows Logon
- **Memory Consumption**: รักษา Steady-State RAM ให้อยู่ในระดับต่ำ (< 25 MB) พร้อมคืนหน่วยความจำและ COM Handlers ทันทีหลังใช้งาน

### 3. Strict Privacy & Ethical Boundaries (PDPA / Privacy by Design)
- **Explicit Data Scope**: เก็บเฉพาะข้อมูลฮาร์ดแวร์, คอนฟิกการ์ดเครือข่าย, เมทาดาทา OS และรายชื่อซอฟต์แวร์ที่ติดตั้งในเครื่อง
- **Strictly Prohibited APIs**: **ไม่มีการใช้งาน** API ดักจับคีย์บอร์ด (`SetWindowsHookEx`), บันทึกหน้าจอ (`CopyFromScreen`), อ่านคลิปบอร์ด, ส่องประวัติเบราว์เซอร์/คุกกี้ หรือสแกนโฟลเดอร์ส่วนตัวใน `C:\Users\*`
- **Sanitized Logging**: บันทึกเฉพาะสถานะการทำงานและ Error โดยไม่ Log ข้อมูลที่เป็นความลับหรือ Credentials

### 4. Local File & Service Hardening
- **Windows ACL Hardening**: ไดเรกทอรีจัดเก็บสถานะ `C:\ProgramData\ITAssetAgent` และ `C:\ProgramData\EnterpriseAssetAgent\Spool` ถูกล็อกด้วย `DirectorySecurity` ให้มีสิทธิ์เขียน/แก้ไขเฉพาะ **`NT AUTHORITY\SYSTEM`** และ **`BUILTIN\Administrators`** เท่านั้น ป้องกัน Standard User หรือมัลแวร์แก้ไขดัดแปลง

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```
c:\Users\meetingroom\Desktop\Programs-iBell\
│
├── AssetMonitoringAgent.csproj         # Target net8.0-windows, Single-File Publish, Polly Resilience
├── Program.cs                          # ProcessPriority BelowNormal, SocketsHttpHandler TLS1.2/1.3, Egress Validation
├── Worker.cs                           # Tri-Loop: Telemetry (5m) + Inventory with Jitter (12h) + Self-Update (6h)
├── appsettings.json                    # BaseApiUrl, ApiKey, Polling Intervals, PinnedCertificateThumbprint
├── appsettings.Development.json        # การตั้งค่า Logging ขณะพัฒนา
├── README.md                           # คู่มือฉบับสมบูรณ์
│
├── Models/
│   ├── AssetPayloads.cs                # DTOs สำหรับ Telemetry, Hardware, SMART, Monitors, EDR และ Software
│   └── AgentCommandPayloads.cs         # DTOs สำหรับ Server Directives, Receipts และ Version Response
│
├── Services/
│   ├── Security/
│   │   └── SecurityValidator.cs        # Egress Allowlist, TLS 1.2/1.3, Cert Pinning และ Directory ACLs
│   ├── IHardwareCollectorService.cs    # Interface การเก็บข้อมูลระบบ
│   ├── HardwareCollectorService.cs     # WMI Timeout 5s, Registry Uninstall 64/32-bit & Process Snapshot
│   ├── IOfflineSpoolingService.cs      # Interface บัฟเฟอร์ออฟไลน์
│   ├── OfflineSpoolingService.cs       # Store-and-Forward Spooler บันทึกลง Disk เมื่อเน็ตหลุด (Cap 50MB)
│   ├── ISecretStorageService.cs        # Interface การเข้ารหัสกุญแจลับ
│   ├── SecretStorageService.cs         # Windows DPAPI (LocalMachine) ป้องกัน API Key รั่วไหล
│   ├── IUpdateService.cs               # Interface ระบบ Self-Update
│   └── UpdateService.cs                # Download, ตรวจสอบ SHA-256 Checksum และ Hot-swap Binary ด้วย .bat
│
├── Scripts/
│   ├── Deploy-Agent.ps1                # Automated Script ติดตั้ง Service พร้อม Recovery Matrix
│   ├── Uninstall-Agent.ps1             # สคริปต์สำหรับลบ Service และคลีนไฟล์
│   ├── Test-AgentHealth.ps1            # เครื่องมือตรวจสุขภาพ Agent และ WMI สำหรับ IT Helpdesk
│   └── Mock-AssetServer.ps1            # Local HTTP Ingestion Server สำหรับทดสอบ
│
├── Installer/
│   └── AgentSetup.iss                  # Inno Setup Script สำหรับทำ Silent Installer (.exe/.msi)
│
└── tests/
    └── AssetMonitoringAgent.Tests/     # xUnit Test Suite (18 Tests: Egress, Regex, DPAPI, Versions)
```

---

## 🧪 การรัน Unit Tests และตรวจสอบระบบ

```powershell
# รันชุดทดสอบความปลอดภัยและฟังก์ชันทั้งหมด (18 ผ่านหมด)
dotnet test .\tests\AssetMonitoringAgent.Tests\AssetMonitoringAgent.Tests.csproj

# รันโหมดตรวจสอบข้อมูลเครื่องทันที (Hardened Inspection Mode)
.\bin\Release\net8.0-windows\win-x64\publish\AssetMonitoringAgent.exe --inspect

# คอมไพล์ Release Single-File
dotnet publish AssetMonitoringAgent.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true
```
