export type WorkspaceEntryGuidance = {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: string;
  secondaryAction: string;
  steps: [string, string, string];
};

export function getWorkspaceEntryGuidance(hasActiveProject: boolean): WorkspaceEntryGuidance {
  if (hasActiveProject) {
    return {
      eyebrow: "พร้อมทำงานต่อ",
      title: "อัปเดตหน้างานให้ครบในไม่กี่นาที",
      description: "เริ่มที่ Daily Report ของวันนี้ แล้วค่อยกลับมาแก้ Project หรือ BOQ เมื่อมีข้อมูลเพิ่ม",
      primaryAction: "เปิด Daily Report วันนี้",
      secondaryAction: "แก้ไข Project + BOQ",
      steps: ["เปิด Daily Report", "บันทึกงานวันนี้", "ติดตามปัญหา"]
    };
  }

  return {
    eyebrow: "เริ่มต้นจากหน้างานจริง",
    title: "สร้างโปรเจกต์แรก แล้วเริ่มบันทึกงานวันนี้",
    description: "กรอกข้อมูลโครงการและ BOQ ก่อน จากนั้นใช้ Daily Report บันทึกงาน คน ปัญหา และแผนพรุ่งนี้ในที่เดียว",
    primaryAction: "สร้างโปรเจกต์แรก",
    secondaryAction: "ดูวิธีเริ่มต้น",
    steps: ["สร้างโปรเจกต์", "ใส่ BOQ", "บันทึก Daily Report"]
  };
}
