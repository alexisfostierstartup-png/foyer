"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import type { User } from "@supabase/supabase-js";

export type UserProfile = {
  id: string;
  email: string;
  display_name: string | null;
  plan: "neophyte" | "expert" | "pro";
  subscription_status: string | null;
  current_period_end: string | null;
};

export type CreditWallet = {
  user_id: string;
  balance: number;
  total_purchased: number;
  total_consumed: number;
};

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<CreditWallet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchProfileAndWallet(userId: string) {
      const [{ data: p }, { data: w }] = await Promise.all([
        supabase.from("profiles" as never).select("*").eq("id", userId).single(),
        supabase.from("credit_wallet" as never).select("*").eq("user_id", userId).single(),
      ]);
      setProfile(p as UserProfile | null);
      setWallet(w as CreditWallet | null);
      setLoading(false);
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetchProfileAndWallet(user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        fetchProfileAndWallet(u.id);
      } else {
        setProfile(null);
        setWallet(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, profile, wallet, loading };
}
