import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}
