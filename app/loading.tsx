export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="flex flex-col items-center gap-3 text-slate-600">
        <span
          aria-hidden
          className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500"
        />
        <p className="text-sm font-medium">กำลังโหลดข้อมูล...</p>
      </div>
    </div>
  );
}