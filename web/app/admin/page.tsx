import Link from "next/link";
import { requireRole } from "@/lib/session";
import { dashboardCounts } from "@/lib/data";
import { STATUS_LABELS } from "@/lib/format";

export default async function AdminDashboard() {
  await requireRole(["admin"]);
  const { byStatus, videos, users, pendingAnalysis } = await dashboardCounts();

  const cards = [
    { label: "Total videos", value: videos },
    { label: "Users", value: users },
    { label: "Awaiting AI analysis", value: pendingAnalysis },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-3xl font-semibold text-emerald-400">{c.value}</div>
            <div className="text-sm text-slate-400">{c.label}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Videos by status</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <div key={key} className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm">
              <span className="text-slate-400">{label}: </span>
              <span className="font-semibold">{byStatus[key] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Link href="/admin/videos" className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500">
          Manage videos
        </Link>
        <Link href="/admin/users" className="rounded border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800">
          Manage users
        </Link>
      </div>
    </div>
  );
}