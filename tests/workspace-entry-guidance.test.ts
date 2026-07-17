import { describe, expect, it } from "vitest";

import { getWorkspaceEntryGuidance } from "@/lib/project-control/workspace-entry-guidance";

describe("workspace entry guidance", () => {
  it("gives first-time users one clear next action", () => {
    expect(getWorkspaceEntryGuidance(false)).toEqual({
      eyebrow: "เริ่มต้นจากหน้างานจริง",
      title: "สร้างโปรเจกต์แรก แล้วเริ่มบันทึกงานวันนี้",
      description: "กรอกข้อมูลโครงการและ BOQ ก่อน จากนั้นใช้ Daily Report บันทึกงาน คน ปัญหา และแผนพรุ่งนี้ในที่เดียว",
      primaryAction: "สร้างโปรเจกต์แรก",
      secondaryAction: "ดูวิธีเริ่มต้น",
      steps: ["สร้างโปรเจกต์", "ใส่ BOQ", "บันทึก Daily Report"]
    });
  });

  it("keeps active-project guidance focused on today's work", () => {
    expect(getWorkspaceEntryGuidance(true)).toEqual({
      eyebrow: "พร้อมทำงานต่อ",
      title: "อัปเดตหน้างานให้ครบในไม่กี่นาที",
      description: "เริ่มที่ Daily Report ของวันนี้ แล้วค่อยกลับมาแก้ Project หรือ BOQ เมื่อมีข้อมูลเพิ่ม",
      primaryAction: "เปิด Daily Report วันนี้",
      secondaryAction: "แก้ไข Project + BOQ",
      steps: ["เปิด Daily Report", "บันทึกงานวันนี้", "ติดตามปัญหา"]
    });
  });
});
