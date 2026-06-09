"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { Json } from "@/lib/db/database.types";

// ─────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────

export type PromptInput = {
  slug: string;
  purpose: string;
  provider: string;
  conditions: Record<string, unknown>;
  template: string;
  notes: string;
  is_active: boolean;
};

export async function createPrompt(input: PromptInput) {
  const { error, data } = await createSupabaseAdmin()
    .from("prompts")
    .insert({
      ...input,
      conditions: input.conditions as Json,
      version: 1,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/admin/prompts");
  return data;
}

export async function updatePrompt(id: string, input: PromptInput) {
  const { data: current, error: fetchErr } = await createSupabaseAdmin()
    .from("prompts")
    .select("version")
    .eq("id", id)
    .single();

  if (fetchErr) throw new Error(fetchErr.message);

  const { error, data } = await createSupabaseAdmin()
    .from("prompts")
    .update({
      ...input,
      conditions: input.conditions as Json,
      version: (current?.version ?? 0) + 1,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/admin/prompts");
  revalidatePath(`/admin/prompts/${id}`);
  return data;
}

export async function togglePromptActive(id: string, is_active: boolean) {
  const { error } = await createSupabaseAdmin()
    .from("prompts")
    .update({ is_active })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/prompts");
  revalidatePath(`/admin/prompts/${id}`);
}

// ─────────────────────────────────────────────
// Assets
// ─────────────────────────────────────────────

export type AssetInput = {
  slug: string;
  category: string;
  notes: string;
  sort_order: number;
  is_active: boolean;
  data: Record<string, unknown>;
};

export async function createAsset(input: AssetInput) {
  const { error, data } = await createSupabaseAdmin()
    .from("assets")
    .insert({ ...input, data: input.data as Json })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/admin/assets");
  revalidatePath(`/admin/assets/${input.category}`);
  return data;
}

export async function updateAsset(id: string, input: AssetInput) {
  const { error, data } = await createSupabaseAdmin()
    .from("assets")
    .update({ ...input, data: input.data as Json })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/admin/assets");
  revalidatePath(`/admin/assets/${input.category}`);
  revalidatePath(`/admin/assets/${input.category}/${id}`);
  return data;
}

export async function toggleAssetActive(id: string, category: string, is_active: boolean) {
  const { error } = await createSupabaseAdmin()
    .from("assets")
    .update({ is_active })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/assets/${category}`);
}
