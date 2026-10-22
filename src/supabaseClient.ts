import { createClient } from '@supabase/supabase-js';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

/** False on a computer that has no .env keys. The page still opens and keeps data in this browser. */
export const supabaseConfigured = supabaseUrl.startsWith('http') && supabaseAnonKey.length > 0;

export const supabase = createClient(
  supabaseConfigured ? supabaseUrl : 'https://localhost.invalid',
  supabaseConfigured ? supabaseAnonKey : 'local-only',
);
