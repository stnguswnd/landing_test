import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

export const supabase = createClient(
  requireEnv(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv(supabaseAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
);
