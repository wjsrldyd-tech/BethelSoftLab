// =============== diablo3-sync.js ===============
// D3 스크립트 에디터 ↔ Supabase d3_scripts / d3_actions 동기화
// bethel-class-manager의 supabase-sync.js 패턴 준수
// tenant_id: BETHEL_TENANT_ID (app_storage 와 동일)

(function () {
    'use strict';

    const TENANT_KEY = 'BETHEL_TENANT_ID';
    const DEFAULT_TENANT_ID = 'default'; // 개인용 고정 tenant (도메인/기기 공통)
    const LS_KEY = 'd3_scripts_v2'; // localStorage 캐시 / 마이그레이션 원본
    const PAGE_SIZE = 50;

    // ─── tenant_id 획득 ───
    function getTenantId() {
        let id = localStorage.getItem(TENANT_KEY);
        // 없거나 softlab- 자동생성 ID면 default로 통일 (Vercel 등 새 도메인 대응)
        if (!id || id.startsWith('softlab-')) {
            id = DEFAULT_TENANT_ID;
            localStorage.setItem(TENANT_KEY, id);
        }
        return id;
    }

    const client = window.supabaseClient;

    if (!client) {
        console.warn('[D3Sync] Supabase 클라이언트 없음 — localStorage 전용 모드');
        window.d3Sync = makeLocalOnlySync();
        return;
    }

    // ─── Supabase CRUD ───────────────────────────────────────────────

    // 목록 조회 (메타만, 직업 필터)
    async function listScripts({ classEn = null, page = 0 } = {}) {
        const tenantId = getTenantId();
        let q = client
            .from('d3_scripts')
            .select('id, class_en, class_ko, title, tags, distance, min_life, keep_exploring, action_count, updated_at')
            .eq('tenant_id', tenantId)
            .order('updated_at', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (classEn && classEn !== '전체') {
            q = q.eq('class_en', classEn);
        }

        const { data, error } = await q;
        if (error) throw error;
        // snake_case → camelCase 변환
        return (data || []).map(snakeToCamel);
    }

    // 스크립트 + Actions 함께 로드 (선택 시)
    async function loadScript(id) {
        const tenantId = getTenantId();

        const [{ data: meta, error: me }, { data: acts, error: ae }] = await Promise.all([
            client.from('d3_scripts')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('id', id)
                .single(),
            client.from('d3_actions')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('script_id', id)
                .order('sort_order', { ascending: true }),
        ]);

        if (me) throw me;
        if (ae) throw ae;

        const script = snakeToCamel(meta);
        script.actions = (acts || []).map(a => {
            const ac = snakeToCamel(a);
            // jsonb 필드 병합 (general/resource/conditional/buff/attack/density → flat)
            return flattenAction(ac);
        });
        return script;
    }

    // 스크립트 메타 upsert (Save 시)
    async function saveScriptMeta(s) {
        const tenantId = getTenantId();
        const row = camelToSnake(s, tenantId);
        row.action_count = (s.actions || []).length;
        delete row.actions; // actions는 d3_actions에 따로 저장

        const { error } = await client
            .from('d3_scripts')
            .upsert(row, { onConflict: 'tenant_id,id' });
        if (error) throw error;
    }

    // Actions 일괄 교체 (script_id 기준 delete → insert)
    async function saveActions(scriptId, actions) {
        const tenantId = getTenantId();

        // 1) 기존 Actions 삭제
        const { error: de } = await client
            .from('d3_actions')
            .delete()
            .eq('tenant_id', tenantId)
            .eq('script_id', scriptId);
        if (de) throw de;

        if (!actions || !actions.length) return;

        // 2) 신규 Actions 삽입
        const rows = actions.map((a, i) => {
            const nested = nestAction(a);
            return {
                id: a.id || ('a' + Date.now() + i + Math.random().toString(36).slice(2, 5)),
                script_id: scriptId,
                tenant_id: tenantId,
                sort_order: i,
                title: a.title || '',
                skill_en: a.skillEn || '',
                skill_ko: a.skillKo || '',
                usage: JSON.stringify(a.usage || []),
                general: JSON.stringify(nested.general),
                resource: JSON.stringify(nested.resource),
                conditional: JSON.stringify(nested.conditional),
                buff: JSON.stringify(nested.buff),
                attack: JSON.stringify(nested.attack),
                density: JSON.stringify(nested.density),
            };
        });

        const { error: ie } = await client.from('d3_actions').insert(rows);
        if (ie) throw ie;
    }

    // 스크립트 삭제 (d3_actions는 cascade)
    async function deleteScript(id) {
        const tenantId = getTenantId();
        const { error } = await client
            .from('d3_scripts')
            .delete()
            .eq('tenant_id', tenantId)
            .eq('id', id);
        if (error) throw error;
    }

    // ─── localStorage 마이그레이션 ───────────────────────────────────
    // 처음 DB로 전환할 때 기존 로컬 데이터를 DB로 올림

    async function migrateFromLocalStorage() {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return 0;

        let localScripts;
        try { localScripts = JSON.parse(raw); } catch { return 0; }
        if (!Array.isArray(localScripts) || !localScripts.length) return 0;

        const tenantId = getTenantId();

        // DB에 이미 데이터가 있으면 마이그레이션 생략
        const { data: existing } = await client
            .from('d3_scripts')
            .select('id')
            .eq('tenant_id', tenantId)
            .limit(1);
        if (existing && existing.length > 0) {
            console.log('[D3Sync] DB에 기존 데이터 있음 — 마이그레이션 생략');
            return 0;
        }

        console.log('[D3Sync] localStorage → DB 마이그레이션 시작:', localScripts.length, '개');
        let count = 0;
        for (const s of localScripts) {
            if (!s.id) continue;
            if (!s.classEn) { s.classEn = 'Crusader'; s.classKo = '성전사'; }
            try {
                await saveScriptMeta(s);
                await saveActions(s.id, s.actions || []);
                count++;
            } catch (e) {
                console.warn('[D3Sync] 마이그레이션 중 오류 (건너뜀):', s.id, e.message);
            }
        }
        console.log('[D3Sync] 마이그레이션 완료:', count, '개');
        return count;
    }

    // ─── 헬퍼 ────────────────────────────────────────────────────────

    // Action flat → 섹션별 nested (DB 저장 형식)
    function nestAction(a) {
        return {
            general: {
                standStill: a.standStill,
                noFastMode: a.noFastMode,
                forceRecast: a.forceRecast,
                ignorePos: a.ignorePos,
                moveAround: a.moveAround,
                breakItems: a.breakItems,
                timer: a.timer,
            },
            resource: {
                resource: a.resource,
                minLifeLevel: a.minLifeLevel,
                channeling: a.channeling,
            },
            conditional: {
                useCustom: a.useCustom,
                customCond: a.customCond,
            },
            buff: {
                buffedResource: a.buffedResource,
                minResLevel: a.minResLevel,
            },
            attack: {
                minMonsters: a.minMonsters,
                attackRange: a.attackRange,
            },
            density: {
                densityCount: a.densityCount,
                densityRange: a.densityRange,
            },
        };
    }

    // DB nested → flat Action (UI에서 쓰는 형식)
    function flattenAction(a) {
        const g = a.general || {};
        const r = a.resource || {};
        const c = a.conditional || {};
        const b = a.buff || {};
        const at = a.attack || {};
        const d = a.density || {};
        return {
            id: a.id,
            title: a.title || '',
            skillEn: a.skillEn || '',
            skillKo: a.skillKo || '',
            usage: Array.isArray(a.usage) ? a.usage : (typeof a.usage === 'string' ? JSON.parse(a.usage) : []),
            standStill: g.standStill,
            noFastMode: g.noFastMode,
            forceRecast: g.forceRecast,
            ignorePos: g.ignorePos,
            moveAround: g.moveAround,
            breakItems: g.breakItems,
            timer: g.timer,
            resource: r.resource,
            minLifeLevel: r.minLifeLevel,
            channeling: r.channeling,
            useCustom: c.useCustom,
            customCond: c.customCond,
            buffedResource: b.buffedResource,
            minResLevel: b.minResLevel,
            minMonsters: at.minMonsters,
            attackRange: at.attackRange,
            densityCount: d.densityCount,
            densityRange: d.densityRange,
        };
    }

    // DB row (snake_case) → JS (camelCase)
    function snakeToCamel(row) {
        const MAP = {
            class_en: 'classEn', class_ko: 'classKo',
            min_life: 'minLife', keep_exploring: 'keepExploring',
            action_count: 'actionCount',
            updated_at: 'updatedAt', created_at: 'createdAt',
            script_id: 'scriptId', sort_order: 'sortOrder',
            skill_en: 'skillEn', skill_ko: 'skillKo',
            tenant_id: 'tenantId',
        };
        const out = {};
        for (const [k, v] of Object.entries(row)) {
            out[MAP[k] || k] = v;
        }
        return out;
    }

    // JS (camelCase) → DB row (snake_case)
    function camelToSnake(s, tenantId) {
        return {
            id: s.id,
            tenant_id: tenantId,
            class_en: s.classEn || '',
            class_ko: s.classKo || '',
            title: s.title || '',
            tags: s.tags || '',
            distance: s.distance ?? 150,
            min_life: s.minLife ?? 101,
            keep_exploring: s.keepExploring !== false,
        };
    }

    // ─── localStorage 전용 폴백 (Supabase 없을 때) ───────────────────
    function makeLocalOnlySync() {
        function load() {
            const raw = localStorage.getItem(LS_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            arr.forEach(s => {
                if (!s.classEn) { s.classEn = 'Crusader'; s.classKo = '성전사'; }
            });
            return arr;
        }
        function save(scripts) {
            localStorage.setItem(LS_KEY, JSON.stringify(scripts));
        }
        return {
            isLocal: true,
            listScripts: async ({ classEn } = {}) => {
                const all = load();
                return classEn && classEn !== '전체' ? all.filter(s => s.classEn === classEn) : all;
            },
            loadScript: async (id) => load().find(s => s.id === id) || null,
            saveScriptMeta: async (s, scripts) => { save(scripts); },
            saveActions: async (scriptId, actions, scripts) => {
                const arr = load();
                const t = arr.find(s => s.id === scriptId);
                if (t) t.actions = actions;
                save(arr);
            },
            deleteScript: async (id, scripts) => { save(scripts.filter(s => s.id !== id)); },
            migrateFromLocalStorage: async () => 0,
        };
    }

    // ─── 공개 API ────────────────────────────────────────────────────
    window.d3Sync = {
        isLocal: false,
        getTenantId,
        listScripts,
        loadScript,
        saveScriptMeta,
        saveActions,
        deleteScript,
        migrateFromLocalStorage,
    };

    console.log('[D3Sync] 초기화 완료 — tenant_id:', getTenantId());
})();
