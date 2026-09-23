import { query, one } from "./db";

export type Video = {
  id: string;
  code: string;
  title: string;
  youtube_url: string | null;
  status: string;
  analysis_state: string;
  analysis_error: string | null;
  assigned_analyst_id: string | null;
  assigned_editor_id: string | null;
  duration_seconds: number | null;
  analyst_name: string | null;
  editor_name: string | null;
  created_at: string;
};

const VIDEO_SELECT = `
  SELECT v.id, v.code, v.title, v.youtube_url, v.status, v.analysis_state,
         v.analysis_error, v.assigned_analyst_id, v.assigned_editor_id,
         v.duration_seconds, v.created_at,
         an.full_name AS analyst_name,
         ed.full_name AS editor_name
    FROM videos v
    LEFT JOIN users an ON an.id = v.assigned_analyst_id
    LEFT JOIN users ed ON ed.id = v.assigned_editor_id
`;

export function listVideos(): Promise<Video[]> {
  return query<Video>(`${VIDEO_SELECT} ORDER BY v.created_at DESC`);
}

export function listAnalystVideos(userId: string): Promise<Video[]> {
  return query<Video>(
    `${VIDEO_SELECT} WHERE v.assigned_analyst_id = $1 ORDER BY v.created_at DESC`,
    [userId]
  );
}

export function listEditorVideos(userId: string): Promise<Video[]> {
  return query<Video>(
    `${VIDEO_SELECT}
      WHERE (v.status = 'completed' AND v.assigned_editor_id IS NULL)
         OR v.assigned_editor_id = $1
      ORDER BY v.created_at DESC`,
    [userId]
  );
}

export function getVideo(id: string): Promise<Video | null> {
  return one<Video>(`${VIDEO_SELECT} WHERE v.id = $1`, [id]);
}

export function getNotes(videoId: string) {
  return query<{
    id: string;
    start_seconds: number;
    end_seconds: number;
    title: string;
    caption: string;
    hashtags: string[];
    hook: string | null;
    reason: string | null;
    score: number | null;
    source: string;
    status: string;
  }>(`SELECT * FROM notes WHERE video_id = $1 ORDER BY start_seconds ASC`, [videoId]);
}

export function getScenes(videoId: string, limit = 40) {
  return query<{
    id: string;
    scene_index: number;
    start_seconds: number;
    end_seconds: number;
    keyframe_url: string | null;
  }>(
    `SELECT * FROM scenes WHERE video_id = $1 ORDER BY scene_index ASC LIMIT $2`,
    [videoId, limit]
  );
}

export function getTranscript(videoId: string) {
  return one<{ language: string | null; segments: { start: number; end: number; text: string }[] }>(
    `SELECT language, segments FROM transcripts WHERE video_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [videoId]
  );
}

export type UserRow = {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: string[];
  created_at: string;
};

export function listUsers(): Promise<UserRow[]> {
  return query<UserRow>(`
    SELECT u.id, u.email, u.full_name, u.is_active, u.created_at,
           COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at ASC
  `);
}

export function listUsersByRole(role: string): Promise<{ id: string; full_name: string; email: string }[]> {
  return query(
    `SELECT u.id, u.full_name, u.email
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
      WHERE ur.role = $1 AND u.is_active = TRUE
      ORDER BY u.full_name ASC`,
    [role]
  );
}

export async function dashboardCounts() {
  const rows = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text AS count FROM videos GROUP BY status`
  );
  const byStatus: Record<string, number> = {};
  for (const r of rows) byStatus[r.status] = Number(r.count);
  const totals = await one<{ videos: string; users: string; pending: string }>(`
    SELECT (SELECT COUNT(*) FROM videos)::text AS videos,
           (SELECT COUNT(*) FROM users)::text AS users,
           (SELECT COUNT(*) FROM videos WHERE analysis_state = 'pending' AND youtube_url IS NOT NULL)::text AS pending
  `);
  return {
    byStatus,
    videos: Number(totals?.videos ?? 0),
    users: Number(totals?.users ?? 0),
    pendingAnalysis: Number(totals?.pending ?? 0),
  };
}