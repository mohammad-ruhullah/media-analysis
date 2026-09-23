import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listAnalystVideos } from "@/lib/data";
import { STATUS_LABELS } from "@/lib/format";

export default async function AnalystHome() {
  const user = await requireRole(["analyst"]);
  const videos = await listAnalystVideos(user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">My Assignments</h1>
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-slate-400">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">AI</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {videos.map((v) => (
              <tr key={v.id} className="border-t border-slate-800">
                <td className="px-3 py-2 font-mono text-xs">{v.code}</td>
                <td className="px-3 py-2">{v.title || "—"}</td>
                <td className="px-3 py-2">{STATUS_LABELS[v.status] ?? v.status}</td>
                <td className="px-3 py-2 text-slate-400">{v.analysis_state}</td>
                <td className="px-3 py-2">
                  <Link href={`/analyst/${v.id}`} className="text-emerald-400 hover:underline">
                    Open workspace
                  </Link>
                </td>
              </tr>
            ))}
            {videos.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                No videos assigned to you yet.
              </td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}