import { createSupabaseAdmin } from "@/lib/supabase/server";
import { nanoid } from "nanoid";

const db = () => createSupabaseAdmin();

// ── Properties ────────────────────────────────────────────────────────────────

export async function listProperties(ownerId: string) {
  const { data } = await db()
    .from("pro_properties")
    .select("*, pro_property_rooms(count)")
    .eq("owner_id", ownerId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function listAllProperties(ownerId: string) {
  const { data } = await db()
    .from("pro_properties")
    .select("*, pro_property_rooms(count)")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getProperty(id: string, ownerId: string) {
  const { data } = await db()
    .from("pro_properties")
    .select("*")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .single();
  return data;
}

export async function createProperty(input: {
  ownerId: string;
  address: string;
  propertyType: string;
  surfaceM2?: number;
  notes?: string;
}) {
  const { data, error } = await db()
    .from("pro_properties")
    .insert({
      owner_id: input.ownerId,
      address: input.address,
      property_type: input.propertyType,
      surface_m2: input.surfaceM2 ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data!;
}

export async function updateProperty(
  id: string,
  ownerId: string,
  updates: { address?: string; status?: string; notes?: string },
) {
  await db()
    .from("pro_properties")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", ownerId);
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

export async function getRooms(propertyId: string) {
  const { data } = await db()
    .from("pro_property_rooms")
    .select("*")
    .eq("property_id", propertyId)
    .order("sort_order");
  return data ?? [];
}

export async function createRoom(input: {
  propertyId: string;
  name: string;
  roomType: string;
  primaryPhotoUrl?: string;
  sortOrder?: number;
}) {
  const { data, error } = await db()
    .from("pro_property_rooms")
    .insert({
      property_id: input.propertyId,
      name: input.name,
      room_type: input.roomType,
      primary_photo_url: input.primaryPhotoUrl ?? null,
      photo_urls: input.primaryPhotoUrl ? [input.primaryPhotoUrl] : [],
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data!;
}

export async function deleteRoom(id: string) {
  await db().from("pro_property_rooms").delete().eq("id", id);
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export async function getJob(id: string, userId: string) {
  const { data } = await db()
    .from("pro_generation_jobs")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  return data;
}

export async function getJobPublic(id: string) {
  const { data } = await db()
    .from("pro_generation_jobs")
    .select("*, pro_properties(address, property_type)")
    .eq("id", id)
    .single();
  return data;
}

export async function listJobs(propertyId: string, userId: string) {
  const { data } = await db()
    .from("pro_generation_jobs")
    .select("*")
    .eq("property_id", propertyId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function listRecentJobs(userId: string, limit = 5) {
  const { data } = await db()
    .from("pro_generation_jobs")
    .select("*, pro_properties(address)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function createJob(input: {
  propertyId: string;
  userId: string;
  mode: string;
  roomIds: string[];
  ambianceSlugs: string[];
  globalConstraints?: string;
}) {
  const total = input.roomIds.length * input.ambianceSlugs.length;
  const { data, error } = await db()
    .from("pro_generation_jobs")
    .insert({
      property_id: input.propertyId,
      user_id: input.userId,
      mode: input.mode,
      rooms_selected: input.roomIds,
      ambiances_selected: input.ambianceSlugs,
      global_constraints: input.globalConstraints ?? null,
      total_renders: total,
    })
    .select()
    .single();
  if (error) throw error;
  return data!;
}

export async function updateJobStatus(
  id: string,
  updates: {
    status?: string;
    completed_renders?: number;
    failed_renders?: number;
    started_at?: string;
    completed_at?: string;
  },
) {
  await db().from("pro_generation_jobs").update(updates).eq("id", id);
}

// ── Renders ───────────────────────────────────────────────────────────────────

export async function getJobRenders(jobId: string) {
  const { data } = await db()
    .from("pro_renders")
    .select("*, pro_property_rooms(name, room_type)")
    .eq("job_id", jobId)
    .order("created_at");
  return data ?? [];
}

export async function createRenders(
  renders: Array<{
    jobId: string;
    roomId: string;
    ambianceSlug: string;
    sourcePhotoUrl: string;
  }>,
) {
  const rows = renders.map((r) => ({
    job_id: r.jobId,
    room_id: r.roomId,
    ambiance_slug: r.ambianceSlug,
    source_photo_url: r.sourcePhotoUrl,
  }));
  const { data, error } = await db()
    .from("pro_renders")
    .insert(rows)
    .select();
  if (error) throw error;
  return data ?? [];
}

export async function updateRender(
  id: string,
  updates: {
    status?: string;
    render_url?: string;
    error_message?: string;
    alterations?: unknown;
    completed_at?: string;
    is_favorite?: boolean;
  },
) {
  await db().from("pro_renders").update(updates).eq("id", id);
}

export async function getPendingRenders(jobId: string) {
  const { data } = await db()
    .from("pro_renders")
    .select("*")
    .eq("job_id", jobId)
    .eq("status", "pending")
    .order("created_at");
  return data ?? [];
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getProStats(userId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [{ count: activeProperties }, { count: rendersThisMonth }] =
    await Promise.all([
      db()
        .from("pro_properties")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", userId)
        .eq("status", "active"),
      db()
        .from("pro_renders")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("created_at", startOfMonth.toISOString()),
    ]);

  return {
    activeProperties: activeProperties ?? 0,
    rendersThisMonth: rendersThisMonth ?? 0,
  };
}

// ── Templates ─────────────────────────────────────────────────────────────────

export async function listTemplates(ownerId: string) {
  const { data } = await db()
    .from("pro_templates")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function createTemplate(input: {
  ownerId: string;
  name: string;
  description?: string;
  ambianceSlugs: string[];
  customConstraints?: string;
}) {
  const { data, error } = await db()
    .from("pro_templates")
    .insert({
      owner_id: input.ownerId,
      name: input.name,
      description: input.description ?? null,
      ambiance_slugs: input.ambianceSlugs,
      custom_constraints: input.customConstraints ? { text: input.customConstraints } : null,
    })
    .select()
    .single();
  if (error) throw error;
  return data!;
}

export async function deleteTemplate(id: string, ownerId: string) {
  await db().from("pro_templates").delete().eq("id", id).eq("owner_id", ownerId);
}

// ── Clients ───────────────────────────────────────────────────────────────────

export async function listClients(ownerId: string) {
  const { data } = await db()
    .from("pro_clients")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function createClient(input: {
  ownerId: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}) {
  const { data, error } = await db()
    .from("pro_clients")
    .insert({
      owner_id: input.ownerId,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data!;
}

export async function deleteClient(id: string, ownerId: string) {
  await db().from("pro_clients").delete().eq("id", id).eq("owner_id", ownerId);
}

// ── Share links ───────────────────────────────────────────────────────────────

export async function createShareLink(jobId: string) {
  const slug = nanoid(10);
  const { data, error } = await db()
    .from("pro_share_links")
    .insert({ job_id: jobId, slug })
    .select()
    .single();
  if (error) throw error;
  return data!;
}

export async function getShareLinkBySlug(slug: string) {
  const { data } = await db()
    .from("pro_share_links")
    .select("*, pro_generation_jobs(*, pro_properties(address, property_type))")
    .eq("slug", slug)
    .single();
  return data;
}

export async function incrementShareViewCount(slug: string) {
  const { data } = await db()
    .from("pro_share_links")
    .select("view_count")
    .eq("slug", slug)
    .single();
  if (data) {
    await db()
      .from("pro_share_links")
      .update({ view_count: data.view_count + 1 })
      .eq("slug", slug);
  }
}

export async function getJobShareLinks(jobId: string) {
  const { data } = await db()
    .from("pro_share_links")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
