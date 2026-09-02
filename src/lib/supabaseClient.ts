import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env',
  );
}

// Note: not using the generated Database generic here — see src/lib/database.types.ts.
// Supabase-js's strict typing requires a `Relationships` field per table to infer
// query results correctly; without it, queries resolve to `never`. The hand-written
// interfaces in each src/lib/api/*.ts file are the source of truth for shapes instead.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
