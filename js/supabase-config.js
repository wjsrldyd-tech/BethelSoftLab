// =============== supabase-config.js ===============
// Supabase 클라이언트 초기화 (벧엘CM과 동일 프로젝트 사용)

(function () {
    'use strict';

    const SUPABASE_URL = 'https://istvmxauwtslvefebxmq.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_A0fvKvQmgmKbITGJPj4RRA_VoFr9dfo';

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        console.error('[Supabase] SDK가 로드되지 않았습니다.');
        return;
    }

    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });

    window.supabaseConfig = { SUPABASE_URL, SUPABASE_ANON_KEY };
})();
