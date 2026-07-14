// =============== origin-db.js ===============
// 대항해시대 오리진 교역소 타이머 ↔ Supabase origin_trade_posts
// tenant_id: BETHEL_TENANT_ID (app_storage, d3_scripts와 공통)

(function () {
    'use strict';

    const TENANT_KEY        = 'BETHEL_TENANT_ID';
    const DEFAULT_TENANT_ID = 'default';
    const TBL               = 'origin_trade_posts';
    const LS_KEY            = 'origin_trade_posts_v1';

    function getTenantId() {
        let id = localStorage.getItem(TENANT_KEY);
        if (!id || id.startsWith('softlab-')) {
            id = DEFAULT_TENANT_ID;
            localStorage.setItem(TENANT_KEY, id);
        }
        return id;
    }

    function genId(prefix) {
        return prefix + Date.now() + Math.random().toString(36).slice(2, 6);
    }

    function rowToPort(row) {
        return {
            id:          row.id,
            tenantId:    row.tenant_id,
            portName:    row.port_name,
            anchorAt:    row.anchor_at,
            intervalMin: row.interval_min ?? 30,
            createdAt:   row.created_at,
            updatedAt:   row.updated_at,
        };
    }

    const client = window.supabaseClient;

    if (!client) {
        console.warn('[OriginDB] Supabase 클라이언트 없음 — localStorage 전용 모드');
        window.originDb = makeLocalOnlyDb();
        return;
    }

    async function listPorts() {
        const { data, error } = await client
            .from(TBL)
            .select('*')
            .eq('tenant_id', getTenantId())
            .order('port_name', { ascending: true });
        if (error) throw error;
        return (data || []).map(rowToPort);
    }

    async function savePort(port) {
        const tenantId = getTenantId();
        const row = {
            id:           port.id || genId('op'),
            tenant_id:    tenantId,
            port_name:    (port.portName || '').trim(),
            anchor_at:    port.anchorAt instanceof Date
                ? port.anchorAt.toISOString()
                : port.anchorAt,
            interval_min: port.intervalMin ?? 30,
            updated_at:   new Date().toISOString(),
        };
        const { error } = await client
            .from(TBL)
            .upsert(row, { onConflict: 'tenant_id,id' });
        if (error) throw error;
        return row.id;
    }

    async function deletePort(id) {
        const { error } = await client
            .from(TBL)
            .delete()
            .eq('tenant_id', getTenantId())
            .eq('id', id);
        if (error) throw error;
    }

    function makeLocalOnlyDb() {
        function loadAll() {
            try {
                return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
            } catch {
                return [];
            }
        }

        function saveAll(list) {
            localStorage.setItem(LS_KEY, JSON.stringify(list));
        }

        return {
            isLocal: true,
            getTenantId,
            listPorts: async () => loadAll().slice().sort((a, b) =>
                (a.portName || '').localeCompare(b.portName || '', 'ko')
            ),
            savePort: async (port) => {
                const all = loadAll();
                const id = port.id || genId('op');
                const row = {
                    id,
                    tenantId: getTenantId(),
                    portName: (port.portName || '').trim(),
                    anchorAt: port.anchorAt instanceof Date
                        ? port.anchorAt.toISOString()
                        : port.anchorAt,
                    intervalMin: port.intervalMin ?? 30,
                    updatedAt: new Date().toISOString(),
                    createdAt: port.createdAt || new Date().toISOString(),
                };
                const idx = all.findIndex(e => e.id === id);
                if (idx >= 0) all[idx] = { ...all[idx], ...row };
                else all.push(row);
                saveAll(all);
                return id;
            },
            deletePort: async (id) => {
                saveAll(loadAll().filter(e => e.id !== id));
            },
        };
    }

    window.originDb = {
        isLocal: false,
        getTenantId,
        listPorts,
        savePort,
        deletePort,
    };

    console.log('[OriginDB] 초기화 완료 — tenant_id:', getTenantId());
})();
