export const tradeOptions = [
  "ทั่วไป",
  "โครงสร้าง",
  "ก่ออิฐ",
  "ฉาบปูน",
  "ฝ้า",
  "สี",
  "กระเบื้อง",
  "ไฟฟ้า",
  "ประปา",
  "แอร์",
  "งานไม้",
  "งานเหล็ก",
  "เก็บงาน",
  "ปูน",
  "ไม้"
];

export function numberFromInput(value: string): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export type WorkspaceNotice = { type: "success" | "error" | "info"; text: string } | null;
