"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export interface AgencyRow {
  id: string;
  name: string;
  deptId: string | null;
  deptsubId: string | null;
  status: number;
  createdAt: string;
  updatedAt: string;
}

interface AgenciesCrudProps {
  initialAgencies: AgencyRow[];
}

type FormState = {
  name: string;
  deptId: string;
  deptsubId: string;
  status: string;
};

const emptyForm: FormState = {
  name: "",
  deptId: "",
  deptsubId: "",
  status: "1",
};

function rowToForm(row: AgencyRow): FormState {
  return {
    name: row.name,
    deptId: row.deptId ?? "",
    deptsubId: row.deptsubId ?? "",
    status: String(row.status),
  };
}

export default function AgenciesCrud({ initialAgencies }: AgenciesCrudProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [agencies, setAgencies] = useState(initialAgencies);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  useEffect(() => {
    setAgencies(initialAgencies);
  }, [initialAgencies]);

  function closeFormOnly() {
    setForm(emptyForm);
    setEditingId(null);
    setShowCreate(false);
  }

  function resetForm() {
    closeFormOnly();
    setMessage(null);
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowCreate(true);
    setMessage(null);
  }

  function startEdit(row: AgencyRow) {
    setShowCreate(false);
    setEditingId(row.id);
    setForm(rowToForm(row));
    setMessage(null);
  }

  async function handleCreate() {
    setMessage(null);
    const res = await fetch("/api/egp/agencies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        deptId: form.deptId.trim() || null,
        deptsubId: form.deptsubId.trim() || null,
        status: Number(form.status),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage({
        type: "err",
        text: typeof data.error === "string" ? data.error : "บันทึกไม่สำเร็จ",
      });
      return;
    }
    closeFormOnly();
    setMessage({ type: "ok", text: "เพิ่มหน่วยงานแล้ว" });
    startTransition(() => router.refresh());
  }

  async function handleUpdate() {
    if (!editingId) return;
    setMessage(null);
    const res = await fetch(`/api/egp/agencies/${encodeURIComponent(editingId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        deptId: form.deptId.trim() || null,
        deptsubId: form.deptsubId.trim() || null,
        status: Number(form.status),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage({
        type: "err",
        text: typeof data.error === "string" ? data.error : "อัปเดตไม่สำเร็จ",
      });
      return;
    }
    closeFormOnly();
    setMessage({ type: "ok", text: "อัปเดตแล้ว" });
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string, name: string) {
    if (
      !window.confirm(
        `ลบหน่วยงาน "${name}" หรือไม่?\nการลบจะทำได้เมื่อไม่มีโครงการ/ประกาศอ้างอิง`,
      )
    ) {
      return;
    }
    setMessage(null);
    const res = await fetch(`/api/egp/agencies/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage({
        type: "err",
        text: typeof data.error === "string" ? data.error : "ลบไม่สำเร็จ",
      });
      return;
    }
    setMessage({ type: "ok", text: "ลบแล้ว" });
    if (editingId === id) closeFormOnly();
    startTransition(() => router.refresh());
  }

  const formActive = showCreate || editingId !== null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={startCreate}
          disabled={isPending}
          className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
        >
          เพิ่มหน่วยงาน
        </button>
      </div>

      {message && (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            message.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </p>
      )}

      {formActive && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            {editingId ? "แก้ไขหน่วยงาน" : "เพิ่มหน่วยงาน"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="agency-name"
                className="mb-1 block text-xs font-medium text-slate-600"
              >
                ชื่อหน่วยงาน <span className="text-red-500">*</span>
              </label>
              <input
                id="agency-name"
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="เช่น โรงพยาบาลราชพิพัฒน์"
              />
            </div>
            <div>
              <label
                htmlFor="agency-dept-id"
                className="mb-1 block text-xs font-medium text-slate-600"
              >
                รหัสหน่วยงานภาครัฐ (deptId)
              </label>
              <input
                id="agency-dept-id"
                type="text"
                value={form.deptId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, deptId: e.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="กรอกได้หลายค่า คั่นด้วย comma เช่น 1001,1002"
              />
            </div>
            <div>
              <label
                htmlFor="agency-deptsub-id"
                className="mb-1 block text-xs font-medium text-slate-600"
              >
                รหัสหน่วยจัดซื้อย่อย (deptsubId)
              </label>
              <input
                id="agency-deptsub-id"
                type="text"
                value={form.deptsubId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, deptsubId: e.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="กรอกได้หลายค่า คั่นด้วย comma เช่น 2001,2002"
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="agency-status"
                className="mb-1 block text-xs font-medium text-slate-600"
              >
                สถานะ
              </label>
              <select
                id="agency-status"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
                className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="1">1 — ใช้งาน (รวมใน ingest)</option>
                <option value="0">0 — ไม่ใช้งาน</option>
              </select>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            ต้องระบุ deptId หรือ deptsubId อย่างน้อยหนึ่งค่า และแต่ละช่องรองรับหลายค่า (คั่นด้วย comma)
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                editingId ? void handleUpdate() : void handleCreate()
              }
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {editingId ? "บันทึกการแก้ไข" : "บันทึก"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={resetForm}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ยกเลิก
            </button>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3 sm:px-6">
          <h2 className="text-sm font-semibold text-slate-900">
            รายการหน่วยงาน ({agencies.length})
          </h2>
        </div>
        {agencies.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-600 sm:px-6">
            ยังไม่มีหน่วยงาน — กด &quot;เพิ่มหน่วยงาน&quot; เพื่อเพิ่มแถวแรก
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium sm:px-6">ชื่อ</th>
                  <th className="px-4 py-3 font-medium">deptId</th>
                  <th className="px-4 py-3 font-medium">deptsubId</th>
                  <th className="px-4 py-3 font-medium">สถานะ</th>
                  <th className="px-4 py-3 font-medium sm:px-6">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {agencies.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="max-w-[200px] px-4 py-3 font-medium sm:max-w-xs sm:px-6">
                      {row.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600 sm:text-xs">
                      {row.deptId ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600 sm:text-xs">
                      {row.deptsubId ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          row.status === 1
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 sm:px-6">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => startEdit(row)}
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-emerald-400 hover:text-emerald-800 sm:text-xs"
                        >
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => void handleDelete(row.id, row.name)}
                          className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 sm:text-xs"
                        >
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        <Link
          href="/egp/announcements"
          className="text-emerald-700 hover:text-emerald-800"
        >
          ← กลับหน้ารายการโครงการ
        </Link>
      </p>
    </div>
  );
}
