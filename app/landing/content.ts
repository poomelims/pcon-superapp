import type { LandingIconName } from "./landing-icons";

export const landingNavItems = [
  { href: "#overview", label: "ภาพรวม" },
  { href: "#features", label: "ฟีเจอร์" },
  { href: "#workflow", label: "วิธีใช้งาน" },
  { href: "#audience", label: "เหมาะกับใคร" }
] as const;

export const siteQuestions: Array<{ title: string; detail: string; icon: LandingIconName }> = [
  { title: "วันนี้ไซต์ทำอะไรไปแล้ว?", detail: "เห็นงานเสร็จและงานต่อเนื่องจากรายงานล่าสุด", icon: "checklist" },
  { title: "ช่างเข้าไซต์กี่คน?", detail: "รวมจำนวนทีมและแรงงานของแต่ละโครงการ", icon: "workers" },
  { title: "งานคืบหน้ากี่เปอร์เซ็นต์?", detail: "ติดตามจากมูลค่างานจริงใน BOQ", icon: "progress" },
  { title: "BOQ รวมเท่าไหร่?", detail: "เห็นยอดหมวดงานและรายการสำคัญในที่เดียว", icon: "boq" },
  { title: "มีปัญหาอะไรต้องตาม?", detail: "แยก Blocker ออกจากข้อมูลทั่วไปให้ชัด", icon: "alert" },
  { title: "พรุ่งนี้ต้องทำอะไรต่อ?", detail: "ต่อแผนวันถัดไปจาก Daily Report วันนี้", icon: "calendar" }
];

export const audiences: Array<{ title: string; detail: string; icon: LandingIconName }> = [
  { title: "ผู้รับเหมา", detail: "เห็นภาพรวมหลายโครงการและเรื่องที่ต้องเข้าไปจัดการ", icon: "contractor" },
  { title: "ผู้ควบคุมไซต์", detail: "บันทึกหน้างานบนมือถือได้อย่างรวดเร็ว", icon: "supervisor" },
  { title: "ทีมรีโนเวตและรับสร้างบ้าน", detail: "ติดตามงบประมาณและความคืบหน้าของงาน", icon: "renovation" },
  { title: "ทีมออฟฟิศ", detail: "ทำงานจากข้อมูลชุดเดียวกับทีมหน้างาน", icon: "office" }
];

export const trustPoints: Array<{ title: string; detail: string; icon: LandingIconName }> = [
  { title: "ข้อมูลคงอยู่หลัง Refresh", detail: "กลับมาทำงานต่อได้โดยไม่ต้องเริ่มกรอกใหม่", icon: "refresh" },
  { title: "BOQ แบบถ่วงน้ำหนัก", detail: "คำนวณ Progress จากมูลค่างาน ไม่ใช่ค่าเฉลี่ยธรรมดา", icon: "progress" },
  { title: "Daily Report มีประวัติ", detail: "สร้าง แก้ไข ลบ และย้อนดูรายงานตามโครงการ", icon: "history" },
  { title: "Import / Export ได้", detail: "สำรองหรือย้ายข้อมูลด้วยไฟล์ JSON", icon: "transfer" }
];
