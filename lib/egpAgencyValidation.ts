const MAX_NAME = 512;
const MAX_CODE = 191;

function trimOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function parseStatus(v: unknown): number | null {
  if (v === 0 || v === 1) return v;
  if (typeof v === "string") {
    if (v === "0") return 0;
    if (v === "1") return 1;
  }
  if (typeof v === "number" && (v === 0 || v === 1)) return v;
  return null;
}

export interface ValidatedAgencyCreate {
  name: string;
  deptId: string | null;
  deptsubId: string | null;
  status: number;
}

export function validateAgencyCreateBody(body: unknown):
  | { ok: true; data: ValidatedAgencyCreate }
  | { ok: false; error: string } {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "รูปแบบข้อมูลไม่ถูกต้อง" };
  }

  const o = body as Record<string, unknown>;
  const nameRaw = o.name;
  if (typeof nameRaw !== "string" || !nameRaw.trim()) {
    return { ok: false, error: "กรุณากรอกชื่อหน่วยงาน" };
  }
  const name = nameRaw.trim();
  if (name.length > MAX_NAME) {
    return { ok: false, error: `ชื่อหน่วยงานยาวเกิน ${MAX_NAME} ตัวอักษร` };
  }

  const deptId = trimOrNull(o.deptId);
  const deptsubId = trimOrNull(o.deptsubId);

  if (deptId && deptId.length > MAX_CODE) {
    return { ok: false, error: `deptId ยาวเกิน ${MAX_CODE} ตัวอักษร` };
  }
  if (deptsubId && deptsubId.length > MAX_CODE) {
    return { ok: false, error: `deptsubId ยาวเกิน ${MAX_CODE} ตัวอักษร` };
  }

  if (!deptId && !deptsubId) {
    return {
      ok: false,
      error: "ต้องระบุ deptId (หน่วยงานภาครัฐ) หรือ deptsubId (หน่วยจัดซื้อย่อย) อย่างน้อยหนึ่งค่า",
    };
  }

  let status: number;
  if ("status" in o) {
    const statusParsed = parseStatus(o.status);
    if (statusParsed === null) {
      return { ok: false, error: "สถานะต้องเป็น 0 หรือ 1" };
    }
    status = statusParsed;
  } else {
    status = 1;
  }

  return {
    ok: true,
    data: { name, deptId, deptsubId, status },
  };
}

export function validateAgencyPatchBody(body: unknown):
  | {
      ok: true;
      data: Partial<ValidatedAgencyCreate> & {
        name?: string;
        deptId?: string | null;
        deptsubId?: string | null;
        status?: number;
      };
    }
  | { ok: false; error: string } {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "รูปแบบข้อมูลไม่ถูกต้อง" };
  }

  const o = body as Record<string, unknown>;
  const out: Partial<ValidatedAgencyCreate> = {};

  if ("name" in o) {
    if (typeof o.name !== "string" || !o.name.trim()) {
      return { ok: false, error: "ชื่อหน่วยงานต้องไม่ว่าง" };
    }
    const name = o.name.trim();
    if (name.length > MAX_NAME) {
      return { ok: false, error: `ชื่อหน่วยงานยาวเกิน ${MAX_NAME} ตัวอักษร` };
    }
    out.name = name;
  }

  if ("deptId" in o) {
    out.deptId = trimOrNull(o.deptId);
  }
  if ("deptsubId" in o) {
    out.deptsubId = trimOrNull(o.deptsubId);
  }

  if ("status" in o) {
    const s = parseStatus(o.status);
    if (s === null) {
      return { ok: false, error: "สถานะต้องเป็น 0 หรือ 1" };
    }
    out.status = s;
  }

  if (Object.keys(out).length === 0) {
    return { ok: false, error: "ไม่มีฟิลด์ที่จะอัปเดต" };
  }

  if (out.deptId !== undefined || out.deptsubId !== undefined) {
    const d =
      out.deptId !== undefined ? out.deptId : undefined;
    const s =
      out.deptsubId !== undefined ? out.deptsubId : undefined;
    if (d && d.length > MAX_CODE) {
      return { ok: false, error: `deptId ยาวเกิน ${MAX_CODE} ตัวอักษร` };
    }
    if (s && s.length > MAX_CODE) {
      return { ok: false, error: `deptsubId ยาวเกิน ${MAX_CODE} ตัวอักษร` };
    }
  }

  return { ok: true, data: out };
}

/** หลัง merge ค่าเดิมกับ patch ต้องยังมี deptId หรือ deptsubId */
export function mergedAgencyHasRssScope(
  current: { deptId: string | null; deptsubId: string | null },
  patch: Partial<ValidatedAgencyCreate>,
): boolean {
  const deptId =
    patch.deptId !== undefined ? patch.deptId : current.deptId;
  const deptsubId =
    patch.deptsubId !== undefined ? patch.deptsubId : current.deptsubId;
  return Boolean(
    (deptId && deptId.trim()) || (deptsubId && deptsubId.trim()),
  );
}
