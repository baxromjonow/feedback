import { createClient } from '@supabase/supabase-js';
import { env } from '../config.js';

// Server-only key. Never import this file into client-side/browser code.
export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);
