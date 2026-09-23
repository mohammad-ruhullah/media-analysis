import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listEditorVideos } from "@/lib/data";
import { STATUS_LABELS } from "@/lib/format";

export default async function EditorHome() {
  const user = await requireRole(["editor"]);
  const videos = await listEditorVideos(user.id);
  const mine = videos.filter((v) => v.assigned_editor_id === user.id);
  const pool = videos.filter((v) => v.assigned_editor_id !== user.id);

  const Table = ({ rows }: { rows: typeof videos }) => (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-left text-slate-400">
          <tr>
            <th className="px-3 py-2">Code</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id} className="border-t border-slate-800">
              <td className="px-3 py-2 font-mono text-xs">{v.code}</td>
              <td className="px-3 py-2">{v.title || "—"}</td>
              <td className="px-3 py-2">{STATUS_LABELS[v.status] ?? v.status}</td>
              <td className="px-3 py-2">
                <Link href={`/editor/${v.id}`} className="text-emerald-400 hover:underline">
                  {v.assigned_editor_id === user.id ? "Open" : "View"}
                </Link>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">Nothing here.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Editing</h1>
      <section className="space-y-3">
        <h2 className="font-medium">Assigned to me</h2>
        <Table rows={mine} />
      </section>
      <section className="space-y-3">
        <h2 className="font-medium">Completed videos (unassigned pool)</h2>
        <Table rows={pool} />
      </section>
    </div>
  );
}