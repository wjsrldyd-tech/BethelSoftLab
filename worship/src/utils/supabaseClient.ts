import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://istvmxauwtslvefebxmq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_A0fvKvQmgmKbITGJPj4RRA_VoFr9dfo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

export const WORSHIP_TABLE = 'worship_records';
export const WORSHIP_BUCKET = 'worship-images';
export const TENANT_ID = 'default';
