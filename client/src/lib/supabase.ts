import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

export const supabase: SupabaseClient | null =
  url && anon ? createClient(url, anon) : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error("NO_SUPABASE");
  }
  return supabase;
}
