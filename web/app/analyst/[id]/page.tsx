import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getVideo, getNotes, getScenes, getTranscript } from "@/lib/data";
import { STATUS_LABELS, secondsToTimecode, youtubeEmbed, youtubeId } from "@/lib/format";
import { saveNote, deleteNote, completeVideo } from "@/app/actions";

function tagsToString(tags: string[]) {
  return (tags ?? []).join(" ");
}

export default async function AnalystWorkspace({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(["analyst"]);
  const { id } = await params;
  const video = await getVideo(id);
  if (!video || video.assigned_analyst_id !== user.id) notFound();

  const [notes, scenes, transcript] = await Promise.all([
    getNotes(id),
    getScenes(id, 24),
    getTranscript(id),
  ]);
  const embed = youtubeEmbed(video.youtube_url);
  const ytId = youtubeId(video.youtube_url);
  const done = video.status === "completed" || video.status === "assigned_to_editor" ||
    video.status === "in_editing" || video.status === "edited" || video.status === "delivered";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          <span className="font-mono text-base text-slate-400">{video.code}</span>{" "}
          {video.title || "Untitled"}
        </h1>
        <Link href="/analyst" className="text-sm text-emerald-400 hover:underline">← My assignments</Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {embed ? (
            <div className="aspect-video overflow-hidden rounded-lg border border-slate-800">
              <iframe src={embed} className="h-full w-full" allowFullScreen title={video.code} />
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800 p-6 text-slate-500">
              No YouTube link yet. Ask an admin to add it.
            </div>
          )}

          <section>
            <h2 className="mb-2 font-medium">Notes &amp; clip suggestions ({notes.length})</h2>
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded border border-slate-800 bg-slate-900/40 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {n.title || "(untitled)"}{" "}
                      <span className={n.source === "ai_draft" ? "text-amber-400" : "text-emerald-400"}>
                        [{n.source}]
                      </span>
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      {secondsToTimecode(n.start_seconds)}–{secondsToTimecode(n.end_seconds)}
                      {n.score != null ? ` · ★${n.score}` : ""}
                    </span>
                  </div>
                  {n.caption ? <p className="mt-1 text-slate-400">{n.caption}</p> : null}

                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-emerald-400">Edit / confirm</summary>
                    <form action={saveNote} className="mt-2 grid grid-cols-2 gap-2">
                      <input type="hidden" name="videoId" value={video.id} />
                      <input type="hidden" name="noteId" value={n.id} />
                      <input name="startSeconds" defaultValue={n.start_seconds} placeholder="start (s)"
                        className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" />
                      <input name="endSeconds" defaultValue={n.end_seconds} placeholder="end (s)"
                        className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" />
                      <input name="title" defaultValue={n.title} placeholder="title"
                        className="col-span-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" />
                      <input name="caption" defaultValue={n.caption} placeholder="caption"
                        className="col-span-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" />
                      <input name="hashtags" defaultValue={tagsToString(n.hashtags)} placeholder="#hashtags"
                        className="col-span-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" />
                      <input name="hook" defaultValue={n.hook ?? ""} placeholder="hook"
                        className="col-span-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" />
                      <button className="rounded bg-emerald-600 px-3 py-1 text-xs hover:bg-emerald-500">
                        Save
                      </button>
                    </form>
                    <form action={deleteNote} className="mt-1">
                      <input type="hidden" name="videoId" value={video.id} />
                      <input type="hidden" name="noteId" value={n.id} />
                      <button className="text-xs text-red-400 hover:underline">Delete</button>
                    </form>
                  </details>
                </li>
              ))}
              {notes.length === 0 ? <li className="text-slate-500">No notes yet.</li> : null}
            </ul>
          </section>

          <section className="rounded border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-3 font-medium">Add a clip note</h2>
            <form action={saveNote} className="grid grid-cols-2 gap-2">
              <input type="hidden" name="videoId" value={video.id} />
              <input name="startSeconds" required placeholder="start (seconds)"
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
              <input name="endSeconds" required placeholder="end (seconds)"
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
              <input name="title" placeholder="Title"
                className="col-span-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
              <input name="caption" placeholder="Caption"
                className="col-span-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
              <input name="hashtags" placeholder="#hashtags"
                className="col-span-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
              <input name="hook" placeholder="Hook line"
                className="col-span-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
              <button className="rounded bg-emerald-600 px-4 py-2 text-sm hover:bg-emerald-500">
                Add note
              </button>
            </form>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-2 font-medium">Finish</h2>
            <p className="mb-3 text-xs text-slate-500">
              Status: {STATUS_LABELS[video.status] ?? video.status}
            </p>
            {done ? (
              <p className="text-sm text-emerald-400">Completed ✓</p>
            ) : (
              <form action={completeVideo}>
                <input type="hidden" name="videoId" value={video.id} />
                <button className="w-full rounded bg-emerald-600 px-3 py-2 text-sm hover:bg-emerald-500">
                  Mark completed
                </button>
              </form>
            )}
          </section>

          {transcript?.segments?.length ? (
            <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="mb-2 font-medium">Transcript</h2>
              <div className="max-h-96 space-y-1 overflow-y-auto text-xs">
                {transcript.segments.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    {ytId ? (
                      <a href={`https://www.youtube.com/watch?v=${ytId}&t=${Math.floor(s.start)}s`}
                        target="_blank" className="font-mono text-emerald-400 hover:underline">
                        {secondsToTimecode(s.start)}
                      </a>
                    ) : (
                      <span className="font-mono text-slate-500">{secondsToTimecode(s.start)}</span>
                    )}
                    <span className="text-slate-300">{s.text}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {scenes.some((s) => s.keyframe_url) ? (
            <section>
              <h2 className="mb-2 font-medium">Keyframes</h2>
              <div className="grid grid-cols-2 gap-2">
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