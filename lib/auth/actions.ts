"use server";
import { createClient, createSupabaseAdmin } from "@/lib/supabase/server";
import { getProject, updateProject, listProjects } from "@/lib/storage/projects";
import { cookies } from "next/headers";

export async function signUp(email: string, password: string, displayName?: string) {
  // Use admin.createUser with email_confirm: true to skip confirmation email entirely.
  // Avoids Supabase free-tier SMTP rate limits; safe for demo/testing.
  const admin = createSupabaseAdmin();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName ?? "" },
  });
  if (error) return { error: error.message };

  // Update profile display_name if provided
  if (created.user && displayName) {
    await admin
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", created.user.id);
  }

  // Sign in immediately to establish the SSR session cookie
  const supabase = await createClient();
  const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { error: signInError.message };

  if (data.user) {
    await claimAnonProjects(data.user.id);
  }
  return { user: data.user };
}

export async function signIn(email: string, password: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  if (data.user) {
    await claimAnonProjects(data.user.id);
  }
  return { user: data.user };
}

export async function claimAnonProjects(userId: string) {
  const cookieStore = await cookies();
  const anonId = cookieStore.get("foyer_anon_id")?.value;
  if (!anonId) return;

  const projects = await listProjects();
  for (const p of projects) {
    if (p.anon_id === anonId && !p.userId) {
      await updateProject(p.id, { userId });
    }
  }
}

export async function getProfile(userId: string) {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return data;
}

export async function getWallet(userId: string) {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("credit_wallet")
    .select("*")
    .eq("user_id", userId)
    .single();
  return data;
}

export async function creditUser(userId: string, delta: number, reason: string) {
  const admin = createSupabaseAdmin();
  const { data: wallet } = await admin
    .from("credit_wallet")
    .select("balance, total_purchased")
    .eq("user_id", userId)
    .single();

  if (!wallet) return;

  const newBalance = wallet.balance + delta;
  const newPurchased = delta > 0 ? wallet.total_purchased + delta : wallet.total_purchased;

  await admin
    .from("credit_wallet")
    .update({ balance: newBalance, total_purchased: newPurchased, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  await admin.from("credit_transactions").insert({
    user_id: userId,
    delta,
    reason,
    created_at: new Date().toISOString(),
  });
}

export async function activateExpertPlan(userId: string) {
  const admin = createSupabaseAdmin();
  await admin
    .from("profiles")
    .update({
      plan: "expert" as const,
      subscription_status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

export async function checkAndConsumeCredit(
  projectId: string,
  userId?: string,
): Promise<{ allowed: boolean; reason?: string }> {
  if (userId) {
    const profile = await getProfile(userId);
    if (profile?.plan === "expert" || profile?.plan === "pro") {
      return { allowed: true };
    }

    const wallet = await getWallet(userId);
    if ((wallet?.balance ?? 0) > 0) {
      await creditUser(userId, -1, `generation:${projectId}`);
      return { allowed: true };
    }

    return { allowed: false, reason: "no_credits" };
  }

  return { allowed: false, reason: "check_cookie" };
}

export async function saveProject(projectId: string, userId: string) {
  const project = await getProject(projectId);
  if (!project) return { error: "Project not found" };
  if (project.userId && project.userId !== userId) return { error: "Forbidden" };

  await updateProject(projectId, { userId, is_saved: true });
  return { ok: true };
}
