"use client";

import { createClient } from "@supabase/supabase-js";

// Client côté navigateur (clé anon, lecture publique seulement)
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
