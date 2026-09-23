"use client";

import { useMemo, useState } from "react";

const RATIOS: Record<string, { w: number; h: number }> = {
  "9:16": { w: 1080, h: 1920 },
  "4:5": { w: 1080, h: 1350 },
  "1:1": { w: 1080, h: 1080 },
  "16:9": { w: 1920, h: 1080 },
  original: { w: 0, h: 0 },
};

function Copyable({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded border border-slate-700 px-2 py-0.5 text-xs hover:bg-slate-800"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded bg-black/60 p-2 text-xs text-emerald-300">{value}</pre>
    </div>
  );
}

export default function RoughCutBuilder({
  youtubeUrl,
  defaultStart,
  defaultEnd,
}: {
  youtubeUrl: string;
  defaultStart?: number;
  defaultEnd?: number;
}) {
  const [start, setStart] = useState(String(defaultStart ?? 0));
  const [end, setEnd] = useState(String(defaultEnd ?? 60));
  const [ratio, setRatio] = useState("9:16");

  const { downloadCmd, trimCmd } = useMemo(() => {
    const s = Number(start) || 0;
    const e = Number(end) || 0;
    const dur = Math.max(0, e - s);
    const { w, h } = RATIOS[ratio];
    const vf =
      w === 0
        ? ""
        : `-vf "scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1" `;
    const downloadCmd = `yt-dlp -f "bv*[height<=1080]+ba/b" --merge-output-format mp4 -o source.mp4 "${youtubeUrl}"`;
    const trimCmd =
      `ffmpeg -y -ss ${s} -i source.mp4 -t ${dur.toFixed(1)} ${vf}` +
      `-c:v libx264 -preset veryfast -crf 20 -c:a aac -b:a 128k clip_${ratio.replace(":", "x")}.mp4`;
    return { downloadCmd, trimCmd };
  }, [start, end, ratio, youtubeUrl]);

  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="font-medium">Rough-cut builder</h2>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-slate-400">
          Start (s)
          <input value={start} onChange={(e) => setStart(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100" />
        </label>
        <label className="text-xs text-slate-400">
          End (s)
          <input value={end} onChange={(e) => setEnd(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100" />
        </label>
        <label className="text-xs text-slate-400">
          Ratio
          <select value={ratio} onChange={(e) => setRatio(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100">
            {Object.keys(RATIOS).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>
      <Copyable label="1) Download source from YouTube" value={downloadCmd} />
      <Copyable label="2) Trim + convert in FFmpeg" value={trimCmd} />
      <p className="text-xs text-slate-500">
        Run these locally, or use your own editor (Resolve, CapCut, …) with the
        timecodes from the notes.
      </p>
    </div>
  );
}