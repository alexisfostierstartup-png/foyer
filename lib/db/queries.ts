import { supabase } from "./client";
import type {
  DbAsset,
  DbProject,
  DbPrompt,
  AssetCategory,
  TablesInsert,
  TablesUpdate,
} from "./database.types";

export async function getAssetsByCategory(category: AssetCategory): Promise<DbAsset[]> {
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("category", category)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

export async function getActivePrompt(
  slug: string,
  purpose: DbPrompt["purpose"],
): Promise<DbPrompt | null> {
  const { data, error } = await supabase
    .from("prompts")
    .select("*")
    .eq("slug", slug)
    .eq("purpose", purpose)
    .eq("is_active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }
  return data;
}

export async function createProject(
  input: TablesInsert<"projects">,
): Promise<DbProject> {
  const { data, error } = await supabase
    .from("projects")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProject(
  id: string,
  patch: TablesUpdate<"projects">,
): Promise<DbProject> {
  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getProject(id: string): Promise<DbProject | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}
