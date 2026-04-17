import { createClient as createSupabaseClient } from '../utils/supabase/client';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

// Function to check if the URL is valid
const isValidUrl = (url: string) => {
  try {
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
};

const isConfigured = isValidUrl(supabaseUrl) && supabaseAnonKey && !supabaseUrl.includes('your-project-url');

if (!isConfigured) {
  console.warn(
    'Emerald Micro-Credit Pro: Supabase IS NOT CONFIGURED.\n' +
    'Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Secrets panel.\n' +
    'Functionality like saving loans will be simulated.'
  );
}

// Export a configured client OR a safe mock to prevent crashes on startup
export const supabase = isConfigured
  ? createSupabaseClient()
  : ({
      from: () => ({
        insert: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        select: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') }),
        update: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        delete: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      }),
      auth: {
        signInWithPassword: () => Promise.resolve({ data: { user: { id: '123', email: 'dev@emerald.com', user_metadata: { full_name: 'Dev User' } }, session: { access_token: 'mock-token' } }, error: null }),
        signInWithOAuth: () => Promise.resolve({ data: { user: { id: '123', email: 'dev@emerald.com' }, session: { access_token: 'mock-token' } }, error: null }),
        signUp: () => Promise.resolve({ data: { user: { id: '123', email: 'dev@emerald.com' }, session: { access_token: 'mock-token' } }, error: null }),
        signOut: () => Promise.resolve({ error: null }),
        onAuthStateChange: (cb: any) => {
          setTimeout(() => cb('SIGNED_IN', { user: { id: '123', email: 'dev@emerald.com', user_metadata: { full_name: 'Dev User' } }, session: { access_token: 'mock-token' } }), 100);
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
        getSession: () => Promise.resolve({ data: { session: { user: { id: '123', email: 'dev@emerald.com' }, access_token: 'mock-token' } }, error: null }),
        updateUser: (data: any) => Promise.resolve({ data: { user: { id: '123', ...data } }, error: null }),
        getUser: () => Promise.resolve({ data: { user: { id: '123', email: 'dev@emerald.com' } }, error: null }),
      }
    } as any);
