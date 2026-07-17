export function resolveAdminTargetCompanyId(requestedCompanyId: string | null | undefined, authenticatedCompanyId: string): string {
  const requested = requestedCompanyId?.trim() ?? "";

  if (!requested) {
    return authenticatedCompanyId;
  }

  if (requested !== authenticatedCompanyId) {
    throw new Error("ไม่มีสิทธิ์จัดการข้อมูลข้ามบริษัท");
  }

  return requested;
}
