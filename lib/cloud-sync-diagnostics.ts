import { type SupabaseClient } from "@supabase/supabase-js";

import { type CloudSyncServerConfig } from "@/lib/supabase/server";

export type CloudSyncServerKeyKind =
  | "sb_secret"
  | "service_role_jwt"
  | "publishable_key_not_allowed"
  | "anon_key_not_allowed"
  | "jwt_unknown"
  | "unknown";

export type CloudSyncHealthTableStatus = {
  table: string;
  status: "ok" | "error";
  message: string;
  advice?: string;
};

export type CloudSyncHealthReport = {
  summary: {
    status: "ok" | "warning" | "error";
    message: string;
  };
  serverEnv: {
    hasSupabaseUrl: boolean;
    hasAnonKey: boolean;
    hasServerKey: boolean;
    hasSyncToken: boolean;
  };
  serverKey: {
    kind: CloudSyncServerKeyKind;
    looksElevated: boolean;
  };
  tables: CloudSyncHealthTableStatus[];
  manualChecks: string[];
};

const requiredTables: Array<{ table: string; columns: string[] }> = [
  { table: "companies", columns: ["id", "name", "slug", "owner_user_id", "created_at", "updated_at"] },
  { table: "company_members", columns: ["id", "company_id", "role", "status", "access_sections", "project_ids"] },
  {
    table: "projects",
    columns: [
      "id",
      "company_id",
      "name",
      "status",
      "owner",
      "team",
      "note",
      "cover_image",
      "customer_name",
      "customer_phone",
      "customer_email",
      "customer_line_id",
      "site_address",
      "site_contact",
      "main_contract",
      "variation_order",
      "start_date",
      "due_date",
      "created_at",
      "updated_at"
    ]
  },
  { table: "boq_categories", columns: ["id", "company_id", "project_id", "name", "sort_order", "created_at", "updated_at"] },
  {
    table: "boq_items",
    columns: ["id", "company_id", "project_id", "category_id", "name", "description", "quantity", "unit", "unit_price", "progress", "sort_order", "created_at", "updated_at"]
  },
  {
    table: "daily_reports",
    columns: [
      "id",
      "company_id",
      "project_id",
      "report_date",
      "prepared_by",
      "prepared_by_phone",
      "summary",
      "completed_work",
      "ongoing_work",
      "problems",
      "materials",
      "next_plan",
      "customer_note",
      "internal_note",
      "problem_issues",
      "photos",
      "created_at",
      "updated_at"
    ]
  },
  {
    table: "daily_report_workers",
    columns: ["id", "company_id", "project_id", "report_id", "crew_id", "name", "trade", "count", "start_time", "end_time", "task_title", "task_status", "note", "created_at", "updated_at"]
  },
  {
    table: "daily_report_progress_updates",
    columns: ["id", "company_id", "project_id", "report_id", "category_id", "item_id", "title", "previous_progress", "new_progress", "note", "created_at", "updated_at"]
  },
  { table: "hr_crews", columns: ["id", "company_id", "leader_name", "national_id", "phone", "work_types", "note", "status", "created_at", "updated_at"] },
  { table: "hr_labor_expenses", columns: ["id", "company_id", "crew_id", "project_id", "expense_date", "work_type", "description", "amount", "note", "created_at", "updated_at"] },
  {
    table: "buyin_entries",
    columns: [
      "id",
      "company_id",
      "project_id",
      "entry_date",
      "type",
      "store_name",
      "vendor_name",
      "vendor_tax_id",
      "description",
      "category",
      "amount_paid",
      "include_vat",
      "net_amount",
      "vat_amount",
      "note",
      "created_at",
      "updated_at"
    ]
  }
];

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const payload = token.split(".")[1];

  if (!payload || typeof globalThis.atob !== "function") {
    return null;
  }

  try {
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const parsed = JSON.parse(globalThis.atob(padded)) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function inferCloudSyncServerKeyKind(key: string): CloudSyncServerKeyKind {
  const trimmed = key.trim();

  if (trimmed.startsWith("sb_secret_")) {
    return "sb_secret";
  }

  if (trimmed.startsWith("sb_publishable_")) {
    return "publishable_key_not_allowed";
  }

  if (trimmed.split(".").length === 3) {
    const role = decodeJwtPayload(trimmed)?.role;

    if (role === "service_role") {
      return "service_role_jwt";
    }

    if (role === "anon") {
      return "anon_key_not_allowed";
    }

    return "jwt_unknown";
  }

  return "unknown";
}

export function formatCloudSyncErrorAdvice(message: string): string {
  const compact = message.toLowerCase();

  if (compact.includes("401") || compact.includes("token") || compact.includes("session")) {
    return "Token/session ไม่ถูกต้อง: ให้ login ใหม่ หรือ Project > Set Token ด้วยค่าเดียวกับ PCON_CLOUD_SYNC_TOKEN";
  }

  if (compact.includes("403") || message.includes("สิทธิ์")) {
    return "สิทธิ์ member/company/project ไม่ตรง: ให้ Admin ตรวจ company_members, role, status และ project_ids";
  }

  if (
    compact.includes("fetch failed") ||
    compact.includes("failed to fetch") ||
    compact.includes("network") ||
    compact.includes("timeout") ||
    compact.includes("timed out") ||
    compact.includes("http 429") ||
    compact.includes("http 500") ||
    compact.includes("http 502") ||
    compact.includes("http 503") ||
    compact.includes("http 504")
  ) {
    return "Cloud ชั่วคราวขัดข้อง: ตรวจ Network แล้วลอง Sync Cloud อีกครั้ง • ข้อมูล local ยังปลอดภัย";
  }

  if (
    compact.includes("schema cache") ||
    compact.includes("could not find the table") ||
    compact.includes("could not find the") ||
    compact.includes("column")
  ) {
    return "Cloud schema ยังไม่ครบ: รัน schema compatibility patch ให้ตรงกับชนิด ID แล้วรัน notify pgrst, 'reload schema'";
  }

  if (compact.includes("42501") || compact.includes("permission denied") || compact.includes("grant")) {
    return "Data API grants ไม่ครบ หรือ SUPABASE_SECRET_KEY ไม่ใช่ secret/service key: ตรวจ grant ให้ service_role และตรวจ env บน Vercel";
  }

  if (compact.includes("invalid input syntax for type uuid")) {
    return "ชนิด ID บน Cloud เป็น uuid แต่ข้อมูล local เป็น text: ใช้ text-id compatibility patch แทน patch uuid";
  }

  return "ตรวจ Cloud Sync diagnostics, Vercel env, Supabase schema/grants และ Network response ของ /api/cloud-sync/push";
}

function isElevatedKey(kind: CloudSyncServerKeyKind): boolean {
  return kind === "sb_secret" || kind === "service_role_jwt";
}

async function checkTable(client: SupabaseClient, table: string, columns: string[]): Promise<CloudSyncHealthTableStatus> {
  const result = await client
    .from(table)
    .select(columns.join(","), { head: true })
    .limit(1);

  if (result.error) {
    return {
      table,
      status: "error",
      message: result.error.message,
      advice: formatCloudSyncErrorAdvice(result.error.message)
    };
  }

  return {
    table,
    status: "ok",
    message: "reachable"
  };
}

export async function runCloudSyncHealthCheck(
  client: SupabaseClient,
  config: CloudSyncServerConfig
): Promise<CloudSyncHealthReport> {
  const keyKind = inferCloudSyncServerKeyKind(config.supabaseServiceRoleKey);
  const tables: CloudSyncHealthTableStatus[] = [];

  for (const { table, columns } of requiredTables) {
    tables.push(await checkTable(client, table, columns));
  }

  const failedTables = tables.filter((table) => table.status === "error");
  const keyLooksElevated = isElevatedKey(keyKind);
  const status = failedTables.length > 0 ? "error" : keyLooksElevated ? "ok" : "warning";

  return {
    summary: {
      status,
      message:
        status === "ok"
          ? "Cloud Sync diagnostics พร้อมใช้งาน"
          : status === "warning"
            ? "Server key อาจไม่ใช่ secret/service key แม้ตารางตอบได้"
            : "พบปัญหา schema/grant/table บน Cloud"
    },
    serverEnv: {
      hasSupabaseUrl: Boolean(config.supabaseUrl),
      hasAnonKey: Boolean(config.supabaseAnonKey),
      hasServerKey: Boolean(config.supabaseServiceRoleKey),
      hasSyncToken: Boolean(config.syncToken)
    },
    serverKey: {
      kind: keyKind,
      looksElevated: keyLooksElevated
    },
    tables,
    manualChecks: [
      "ตรวจ Supabase Settings > API ว่าตาราง public ที่ใช้ sync เปิด Data API หรือ grant ให้ service_role แล้ว",
      "ตรวจ RLS enabled ใน SQL Editor ด้วย pg_tables เพราะ health API ไม่ส่งข้อมูลลูกค้าออกมา",
      "ถ้า schema cache เพี้ยน ให้รัน notify pgrst, 'reload schema'",
      "ถ้า ID เป็น text ให้ใช้ cloud-sync-schema-compatibility-text-ids.sql"
    ]
  };
}
