import { createBrowserClient } from "@supabase/ssr";

// We use import.meta.env because it's the Vite standard for exposing env vars
// We also fallback to process.env because vite.config.ts defines them there for compatibility
// @ts-ignore
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
// @ts-ignore
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();

export const createClient = () => {
  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Supabase configuration missing in client.ts!");
    throw new Error("Supabase configuration missing!");
  }
  
  // Useful for debugging but keeps it safe
  if (supabaseUrl.includes("mwbqjvmmgnopgpgplgzi")) {
    console.log("📍 Supabase URL identified correctly.");
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseKey,
  );
};
