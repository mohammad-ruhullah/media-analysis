import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getVideo, getNotes, getScenes, listUsersByRole } from "@/lib/data";
import { STATUS_LABELS, secondsToTimecode, youtubeEmbed } from "@/lib/format";
import { assignAnalyst, assignEditor } from "@/app/actions";

export default async function AdminVideoDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin"]);
  const { id } = await params;
  const video = await getVideo(id);
  if (!video) notFound();

  const [notes, scenes, analysts, editors] = await Promise.all([
    getNotes(id),
    getScenes(id, 12),
    listUsersByRole("analyst"),
    listUsersByRole("editor"),
  ]);
  const embed = youtubeEmbed(video.youtube_url);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          <span className="font-mono text-base text-slate-400">{video.code}</span>{" "}
          {video.title || "Untitled"}
        </h1>
        <Link href="/admin/videos" className="text-sm text-emerald-400 hover:underline">
          ← All videos
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {embed ? (
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-slate-800">
              <iframe src={embed} className="h-full w-full" allowFullScreen title={video.code} />
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800 p-6 text-slate-500">
              No YouTube link registered yet.
            </div>
          )}

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-slate-400">Status:</span> {STATUS_LABELS[video.status] ?? video.status}</div>
              <div><span className="text-slate-400">Analysis:</span> {video.analysis_state}</div>
              {video.analysis_error ? (
                <div className="col-span-2 text-red-400">Error: {video.analysis_error}</div>
              ) : null}
            </div>
          </div>

          <div>
            <h2 className="mb-2 font-medium">Notes ({notes.length})</h2>
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded border border-slate-800 bg-slate-900/40 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{n.title || "(untitled)"}</span>
                    <span className="font-mono text-xs text-slate-400">
                      {secondsToTimecode(n.start_seconds)}–{secondsToTimecode(n.end_seconds)}
                      {" · "}
                      <span className={n.source === "ai_draft" ? "text-amber-400" : "text-emerald-400"}>
                        {n.source}
                      </span>
                    </span>
                  </div>
                  {n.caption ? <p className="mt-1 text-slate-400">{n.caption}</p> : null}
                </li>
              ))}
              {notes.length === 0 ? <li className="text-slate-500">No notes yet.</li> : null}
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-3 font-medium">Assign analyst</h2>
            <p className="mb-2 text-xs text-slate-500">
              Current: {video.analyst_name ?? "unassigned"}
            </p>
            <form action={assignAnalyst} className="space-y-2">
              <input type="hidden" name="videoId" value={video.id} />
              <select name="analystId" required
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
                <option value="">Select analyst…</option>
                {analysts.map((a) => (
                  <option key={a.id} value={a.id}>{a.full_name || a.email}</option>
                ))}
              </select>
              <button className="w-full rounded bg-emerald-600 px-3 py-2 text-sm hover:bg-emerald-500">
                Assign analyst
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-3 font-medium">Assign editor</h2>
            <p className="mb-2 text-xs text-slate-500">
              Current: {video.editor_name ?? "unassigned"}
            </p>
            <form action={assignEditor} className="space-y-2">
              <input type="hidden" name="videoId" value={video.id} />
              <select name="editorId" required
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
                <option value="">Select editor…</option>
                {editors.map((e) => (
                  <option key={e.id} value={e.id}>{e.full_name || e.email}</option>
                ))}
              </select>
              <button className="w-full rounded bg-emerald-600 px-3 py-2 text-sm hover:bg-emerald-500">
                Assign editor
              </button>
            </form>
          </section>

          {scenes.some((s) => s.keyframe_url) ? (
            <section>
              <h2 className="mb-2 font-medium">Keyframes</h2>
              <div className="grid grid-cols-3 gap-2">
                {scenes.filter((s) => s.keyframe_url).map((s) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={s.id} src={s.keyframe_url!} alt={`Scene ${s.scene_index}`}
                    className="aspect-video w-full rounded object-cover" />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}