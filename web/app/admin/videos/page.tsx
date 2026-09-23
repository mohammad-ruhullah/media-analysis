import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listVideos } from "@/lib/data";
import { STATUS_LABELS } from "@/lib/format";
import { addVideo } from "@/app/actions";

export default async function AdminVideos() {
  await requireRole(["admin"]);
  const videos = await listVideos();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Videos</h1>

      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="mb-3 font-medium">Register a recovered CD / YouTube link</h2>
        <form action={addVideo} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input name="code" required placeholder="Video code (e.g. DOC001_S01)"
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2" />
          <input name="title" placeholder="Title"
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2" />
          <input name="discLabel" placeholder="Disc label (e.g. DOC001)"
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2" />
          <input name="youtubeUrl" placeholder="YouTube URL (Unlisted)"
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2" />
          <button className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 sm:col-span-2">
            Save video
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Adding a video with a YouTube URL queues it for automatic AI analysis.
        </p>
      </section>

      <section>
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-slate-400">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Analysis</th>
                <th className="px-3 py-2">Analyst</th>
                <th className="px-3 py-2">Editor</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.id} className="border-t border-slate-800">
                  <td className="px-3 py-2 font-mono text-xs">{v.code}</td>
                  <td className="px-3 py-2">{v.title || "—"}</td>
                  <td className="px-3 py-2">{STATUS_LABELS[v.status] ?? v.status}</td>
                  <td className="px-3 py-2">
                    <span className={v.analysis_state === "done" ? "text-emerald-400" : v.analysis_state === "error" ? "text-red-400" : "text-slate-400"}>
                      {v.analysis_state}
                    </span>
                  </td>
                  <td className="px-3 py-2">{v.analyst_name ?? "—"}</td>
                  <td className="px-3 py-2">{v.editor_name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/videos/${v.id}`} className="text-emerald-400 hover:underline">
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
              {videos.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">No videos yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}