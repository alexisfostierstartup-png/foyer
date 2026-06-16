import { nanoid } from "nanoid";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { Project, RoomType } from "@/lib/types";

// ── All project state lives in foyer_projects.data (jsonb).
// ── No filesystem writes — works on Vercel's read-only environment.

export function buildStorageFolder(userId: string | undefined, projectId: string): string {
  // Lisible (triable par date) ET unique. Le suffixe projectId (nanoid) garantit
  // zéro collision : auparavant un compteur (UN/PR + n) redescendait à la
  // suppression d'un projet → réutilisation du dossier d'un ancien → médias
  // écrasés. Le projectId élimine ce risque tout en gardant un nom lisible.
  const now = new Date();
  const date = now.toISOString().slice(0, 10); // 2026-06-16
  const time = now.toTimeString().slice(0, 5).replace(":", "-"); // 20-35
  const stamp = `${date}_${time}`;
  return userId
    ? `${userId}/${stamp}_${projectId}`
    : `${stamp}_UN_${projectId}`;
}

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await createSupabaseAdmin()
    .from("foyer_projects")
    .select("data")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[projects] listProjects error:", error.message);
    return [];
  }
  return (data ?? []).map((row) => row.data as Project);
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await createSupabaseAdmin()
    .from("foyer_projects")
    .select("data")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data.data as Project;
}

export async function createProject(
  roomType: RoomType,
  basePhotoUrl: string,
  storageFolder: string,
  userId?: string,
  id?: string,
  anonId?: string,
): Promise<Project> {
  const projectId = id ?? nanoid();
  const project: Project = {
    id: projectId,
    createdAt: new Date().toISOString(),
    userId,
    anon_id: anonId,
    is_saved: false,
    live_edits_used: 0,
    storageFolder,
    roomType,
    basePhotoUrl,
    selectedStyleId: null,
    generatedRenderUrl: null,
    detectedFurniture: [],
    architecture: null,
    userConstraints: null,
  };

  const { error } = await createSupabaseAdmin()
    .from("foyer_projects")
    .insert({
      id: projectId,
      user_id: userId ?? null,
      anon_id: anonId ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: project as any,
    });

  if (error) throw new Error(`Failed to create project: ${error.message}`);
  return project;
}

export async function updateProject(
  id: string,
  updates: Partial<Omit<Project, "id" | "createdAt">>,
): Promise<Project | null> {
  // Fetch current, merge, write back — keeps all existing fields
  const { data: row, error: fetchError } = await createSupabaseAdmin()
    .from("foyer_projects")
    .select("data")
    .eq("id", id)
    .single();

  if (fetchError || !row) return null;

  const current = row.data as Project;
  const updated: Project = { ...current, ...updates };

  const { error: updateError } = await createSupabaseAdmin()
    .from("foyer_projects")
    .update({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: updated as any,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    console.error("[projects] updateProject error:", updateError.message);
    return null;
  }
  return updated;
}
