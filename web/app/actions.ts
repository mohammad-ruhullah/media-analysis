"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { query, one } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { signOut } from "@/auth";

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

async function log(videoId: string | null, actorId: string, action: string, detail: unknown = {}) {
  await query(
    `INSERT INTO activity_log (video_id, actor_id, action, detail) VALUES ($1, $2, $3, $4)`,
    [videoId, actorId, action, JSON.stringify(detail)]
  );
}

function parseHashtags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`));
}

/* ---------------- Admin: users ---------------- */

export async function createUser(formData: FormData) {
  const admin = await requireRole(["admin"]);
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const roles = formData.getAll("roles").map(String).filter(Boolean);
  if (!email || !password || roles.length === 0) return;

  const hash = await bcrypt.hash(password, 10);
  const user = await one<{ id: string }>(
    `INSERT INTO users (email, password_hash, full_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING id`,
    [email, hash, fullName]
  );
  if (user) {
    for (const role of roles) {
      await query(
        `INSERT INTO user_roles (user_id, role, granted_by) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, role) DO NOTHING`,
        [user.id, role, admin.id]
      );
    }
  }
  revalidatePath("/admin/users");
}

export async function setUserRoles(formData: FormData) {
  const admin = await requireRole(["admin"]);
  const userId = String(formData.get("userId") ?? "");
  const roles = formData.getAll("roles").map(String).filter(Boolean);
  if (!userId) return;
  await query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
  for (const role of roles) {
    await query(
      `INSERT INTO user_roles (user_id, role, granted_by) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, role) DO NOTHING`,
      [userId, role, admin.id]
    );
  }
  revalidatePath("/admin/users");
}

export async function resetPassword(formData: FormData) {
  await requireRole(["admin"]);
  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!userId || !password) return;
  const hash = await bcrypt.hash(password, 10);
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, userId]);
  revalidatePath("/admin/users");
}

export async function toggleUserActive(formData: FormData) {
  await requireRole(["admin"]);
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  await query(`UPDATE users SET is_active = NOT is_active WHERE id = $1`, [userId]);
  revalidatePath("/admin/users");
}

/* ---------------- Admin: videos ---------------- */

export async function addVideo(formData: FormData) {
  const admin = await requireRole(["admin"]);
  const code = String(formData.get("code") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const youtubeUrl = String(formData.get("youtubeUrl") ?? "").trim();
  const discLabel = String(formData.get("discLabel") ?? "").trim();
  if (!code) return;

  let discId: string | null = null;
  if (discLabel) {
    const disc = await one<{ id: string }>(
      `INSERT INTO discs (label) VALUES ($1)
       ON CONFLICT (label) DO UPDATE SET label = EXCLUDED.label
       RETURNING id`,
      [discLabel]
    );
    discId = disc?.id ?? null;
  }

  const video = await one<{ id: string }>(
    `INSERT INTO videos (disc_id, code, title, youtube_url, status, analysis_state)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     ON CONFLICT (code) DO UPDATE
       SET title = EXCLUDED.title, youtube_url = EXCLUDED.youtube_url
     RETURNING id`,
    [discId, code, title, youtubeUrl || null, youtubeUrl ? "linked" : "recovered"]
  );
  if (video) await log(video.id, admin.id, "video_added", { code });
  revalidatePath("/admin/videos");
}

export async function assignAnalyst(formData: FormData) {
  const admin = await requireRole(["admin"]);
  const videoId = String(formData.get("videoId") ?? "");
  const analystId = String(formData.get("analystId") ?? "");
  if (!videoId || !analystId) return;
  await query(
    `UPDATE videos SET assigned_analyst_id = $1, status = 'assigned_to_analyst' WHERE id = $2`,
    [analystId, videoId]
  );
  await query(
    `INSERT INTO assignments (video_id, role, user_id, assigned_by) VALUES ($1, 'analyst', $2, $3)`,
    [videoId, analystId, admin.id]
  );
  await log(videoId, admin.id, "analyst_assigned", { analystId });
  revalidatePath(`/admin/videos/${videoId}`);
  revalidatePath("/admin/videos");
}

export async function assignEditor(formData: FormData) {
  const admin = await requireRole(["admin"]);
  const videoId = String(formData.get("videoId") ?? "");
  const editorId = String(formData.get("editorId") ?? "");
  if (!videoId || !editorId) return;
  await query(
    `UPDATE videos SET assigned_editor_id = $1, status = 'assigned_to_editor' WHERE id = $2`,
    [editorId, videoId]
  );
  await query(
    `INSERT INTO assignments (video_id, role, user_id, assigned_by) VALUES ($1, 'editor', $2, $3)`,
    [videoId, editorId, admin.id]
  );
  await log(videoId, admin.id, "editor_assigned", { editorId });
  revalidatePath(`/admin/videos/${videoId}`);
  revalidatePath("/admin/videos");
}

/* ---------------- Analyst ---------------- */

export async function saveNote(formData: FormData) {
  const user = await requireRole(["analyst"]);
  const videoId = String(formData.get("videoId") ?? "");
  const noteId = String(formData.get("noteId") ?? "");
  const start = Number(formData.get("startSeconds") ?? 0);
  const end = Number(formData.get("endSeconds") ?? 0);
  const title = String(formData.get("title") ?? "");
  const caption = String(formData.get("caption") ?? "");
  const hashtags = parseHashtags(String(formData.get("hashtags") ?? ""));
  const hook = String(formData.get("hook") ?? "");
  if (!videoId) return;

  const video = await one<{ assigned_analyst_id: string | null }>(
    `SELECT assigned_analyst_id FROM videos WHERE id = $1`,
    [videoId]
  );
  if (!video || video.assigned_analyst_id !== user.id) return;

  if (noteId) {
    await query(
      `UPDATE notes SET start_seconds=$1, end_seconds=$2, title=$3, caption=$4,
             hashtags=$5, hook=$6, source='analyst'
       WHERE id=$7 AND video_id=$8`,
      [start, end, title, caption, hashtags, hook, noteId, videoId]
    );
  } else {
    await query(
      `INSERT INTO notes (video_id, start_seconds, end_seconds, title, caption, hashtags, hook, source, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'analyst','draft',$8)`,
      [videoId, start, end, title, caption, hashtags, hook, user.id]
    );
  }
  revalidatePath(`/analyst/${videoId}`);
}

export async function deleteNote(formData: FormData) {
  const user = await requireRole(["analyst"]);
  const noteId = String(formData.get("noteId") ?? "");
  const videoId = String(formData.get("videoId") ?? "");
  if (!noteId) return;
  const video = await one<{ assigned_analyst_id: string | null }>(
    `SELECT assigned_analyst_id FROM videos WHERE id = $1`,
    [videoId]
  );
  if (!video || video.assigned_analyst_id !== user.id) return;
  await query(`DELETE FROM notes WHERE id = $1`, [noteId]);
  revalidatePath(`/analyst/${videoId}`);
}

export async function completeVideo(formData: FormData) {
  const user = await requireRole(["analyst"]);
  const videoId = String(formData.get("videoId") ?? "");
  if (!videoId) return;
  const video = await one<{ assigned_analyst_id: string | null; code: string }>(
    `SELECT assigned_analyst_id, code FROM videos WHERE id = $1`,
    [videoId]
  );
  if (!video || video.assigned_analyst_id !== user.id) return;
  await query(
    `UPDATE videos SET status = 'completed', completed_at = now() WHERE id = $1`,
    [videoId]
  );
  await log(videoId, user.id, "analysis_completed");
  revalidatePath("/analyst");
  revalidatePath(`/editor`);
  redirect("/analyst");
}

/* ---------------- Editor ---------------- */

async function editorOwns(videoId: string, userId: string) {
  const v = await one<{ assigned_editor_id: string | null }>(
    `SELECT assigned_editor_id FROM videos WHERE id = $1`,
    [videoId]
  );
  return !!v && v.assigned_editor_id === userId;
}

export async function startEditing(formData: FormData) {
  const user = await requireRole(["editor"]);
  const videoId = String(formData.get("videoId") ?? "");
  if (!(await editorOwns(videoId, user.id))) return;
  await query(`UPDATE videos SET status = 'in_editing' WHERE id = $1`, [videoId]);
  await log(videoId, user.id, "editing_started");
  revalidatePath(`/editor/${videoId}`);
}

export async function markEdited(formData: FormData) {
  const user = await requireRole(["editor"]);
  const videoId = String(formData.get("videoId") ?? "");
  if (!(await editorOwns(videoId, user.id))) return;
  await query(`UPDATE videos SET status = 'edited' WHERE id = $1`, [videoId]);
  await log(videoId, user.id, "editing_done");
  revalidatePath(`/editor/${videoId}`);
}

export async function markDelivered(formData: FormData) {
  const user = await requireRole(["editor"]);
  const videoId = String(formData.get("videoId") ?? "");
  if (!(await editorOwns(videoId, user.id))) return;
  await query(`UPDATE videos SET status = 'delivered' WHERE id = $1`, [videoId]);
  await log(videoId, user.id, "delivered");
  revalidatePath(`/editor/${videoId}`);
}