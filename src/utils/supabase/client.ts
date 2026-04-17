import { createBrowserClient } from "@supabase/ssr";

// We use process.env because it's explicitly defined in vite.config.ts for these keys
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

export const createClient = () =>
  createBrowserClient(
    supabaseUrl!,
    supabaseKey!,
  );
