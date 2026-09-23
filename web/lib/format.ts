export function secondsToTimecode(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "00:00:00";
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

export function timecodeToSeconds(tc: string): number | null {
  if (!tc) return null;
  const parts = tc.trim().split(":").map((p) => Number(p));
  if (parts.some((p) => Number.isNaN(p))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

export function youtubeId(url: string | null): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export function youtubeEmbed(url: string | null, startSeconds?: number): string | null {
  const id = youtubeId(url);
  if (!id) return null;
  const t = startSeconds && startSeconds > 0 ? `?start=${Math.floor(startSeconds)}` : "";
  return `https://www.youtube.com/embed/${id}${t}`;
}

export const STATUS_LABELS: Record<string, string> = {
  recovered: "Recovered",
  linked: "Linked",
  assigned_to_analyst: "Assigned to analyst",
  in_analysis: "In analysis",
  completed: "Completed",
  assigned_to_editor: "Assigned to editor",
  in_editing: "In editing",
  edited: "Edited",
  delivered: "Delivered",
};