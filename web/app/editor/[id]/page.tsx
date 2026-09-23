import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getVideo, getNotes } from "@/lib/data";
import { STATUS_LABELS, secondsToTimecode, youtubeEmbed, youtubeId } from "@/lib/format";
import { startEditing, markEdited, markDelivered } from "@/app/actions";
import RoughCutBuilder from "@/components/RoughCutBuilder";

export default async function EditorVideo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(["editor"]);
  const { id } = await params;
  const video = await getVideo(id);
  if (!video) notFound();

  const owns = video.assigned_editor_id === user.id;
  const inPool = video.status === "completed" && video.assigned_editor_id === null;
  if (!owns && !inPool) notFound();

  const notes = await getNotes(id);
  const embed = youtubeEmbed(video.youtube_url);
  const ytId = youtubeId(video.youtube_url);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          <span className="font-mono text-base text-slate-400">{video.code}</span>{" "}
          {video.title || "Untitled"}
        </h1>
        <Link href="/editor" className="text-sm text-emerald-400 hover:underline">← Editing</Link>
      </div>

      {inPool && !owns ? (
        <div className="rounded border border-amber-700 bg-amber-900/20 p-3 text-sm text-amber-300">
          This video is in the completed pool and not assigned to you. Ask an admin to assign it
          before working on it.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {embed ? (
            <div className="aspect-video overflow-hidden rounded-lg border border-slate-800">
              <iframe src={embed} className="h-full w-full" allowFullScreen title={video.code} />
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800 p-6 text-slate-500">No source link.</div>
          )}

          <section>
            <h2 className="mb-2 font-medium">Notes with timecodes ({notes.length})</h2>
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded border border-slate-800 bg-slate-900/40 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{n.title || "(untitled)"}</span>
                    <span className="font-mono text-xs text-slate-400">
                      {secondsToTimecode(n.start_seconds)}–{secondsToTimecode(n.end_seconds)}
                    </span>
                  </div>
                  {n.caption ? <p className="mt-1 text-slate-400">{n.caption}</p> : null}
                  {n.hashtags?.length ? (
                    <p className="mt-1 text-xs text-emerald-400">{n.hashtags.join(" ")}</p>
                  ) : null}
                  <div className="mt-2 flex gap-3 text-xs">
                    {ytId ? (
                      <>
                        <a href={`https://www.youtube.com/watch?v=${ytId}&t=${Math.floor(n.start_seconds)}s`}
                          target="_blank" className="text-emerald-400 hover:underline">Open start</a>
                        <a href={`https://www.youtube.com/watch?v=${ytId}&t=${Math.floor(n.end_seconds)}s`}
                          target="_blank" className="text-emerald-400 hover:underline">Open end</a>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
              {notes.length === 0 ? <li className="text-slate-500">No notes.</li> : null}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          {owns ? (
            <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="mb-2 font-medium">Status</h2>
              <p className="mb-3 text-xs text-slate-500">
                Current: {STATUS_LABELS[video.status] ?? video.status}
              </p>
              <div className="space-y-2">
                <form action={startEditing}>
                  <input type="hidden" name="videoId" value={video.id} />
                  <button className="w-full rounded border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">
                    Mark in editing
                  </button>
                </form>
                <form action={markEdited}>
                  <input type="hidden" name="videoId" value={video.id} />
                  <button className="w-full rounded bg-emerald-600 px-3 py-2 text-sm hover:bg-emerald-500">
                    Mark edited
                  </button>
                </form>
                <form action={markDelivered}>
                  <input type="hidden" name="videoId" value={video.id} />
                  <button className="w-full rounded border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">
                    Mark delivered
                  </button>
                </form>
              </div>
            </section>
          ) : null}

          {video.youtube_url ? (
            <RoughCutBuilder
              youtubeUrl={video.youtube_url}
              defaultStart={notes[0]?.start_seconds ?? 0}
              defaultEnd={notes[0]?.end_seconds ?? 60}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}