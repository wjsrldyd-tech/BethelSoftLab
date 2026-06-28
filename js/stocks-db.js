// =============== stocks-db.js ===============
// 주식 도구 ↔ Supabase stocks_instruments / stocks_pp_entries 동기화
// diablo3-sync.js 패턴 준수
// tenant_id: BETHEL_TENANT_ID (app_storage, d3_scripts와 공통)

(function () {
    'use strict';

    const TENANT_KEY       = 'BETHEL_TENANT_ID';
    const DEFAULT_TENANT_ID = 'default';
    const TBL_INST  = 'stocks_instruments';
    const TBL_PP    = 'stocks_pp_entries';

    // ─── tenant_id 획득 ───────────────────────────────────────────────
    function getTenantId() {
        let id = localStorage.getItem(TENANT_KEY);
        if (!id || id.startsWith('softlab-')) {
            id = DEFAULT_TENANT_ID;
            localStorage.setItem(TENANT_KEY, id);
        }
        return id;
    }

    // ─── ID 생성 ──────────────────────────────────────────────────────
    function genId(prefix) {
        return prefix + Date.now() + Math.random().toString(36).slice(2, 6);
    }

    const client = window.supabaseClient;

    if (!client) {
        console.warn('[StocksDB] Supabase 클라이언트 없음 — localStorage 전용 모드');
        window.stocksDb = makeLocalOnlyDb();
        return;
    }

    // ════════════════════════════════════════════════════════════════
    // stocks_instruments CRUD
    // ════════════════════════════════════════════════════════════════

    async function listInstruments() {
        const { data, error } = await client
            .from(TBL_INST)
            .select('*')
            .eq('tenant_id', getTenantId())
            .order('ticker', { ascending: true });
        if (error) throw error;
        return (data || []).map(rowToInstrument);
    }

    async function saveInstrument(inst) {
        const tenantId = getTenantId();
        const row = {
            id:         inst.id || genId('i'),
            tenant_id:  tenantId,
            ticker:     inst.ticker  || '',
            name:       inst.name    || '',
            market:     inst.market  || '',
            note:       inst.note    || '',
            updated_at: new Date().toISOString(),
        };
        const { error } = await client
            .from(TBL_INST)
            .upsert(row, { onConflict: 'tenant_id,id' });
        if (error) throw error;
        return row.id;
    }

    async function deleteInstrument(id) {
        const { error } = await client
            .from(TBL_INST)
            .delete()
            .eq('tenant_id', getTenantId())
            .eq('id', id);
        if (error) throw error;
    }

    // ════════════════════════════════════════════════════════════════
    // stocks_pp_entries CRUD
    // ════════════════════════════════════════════════════════════════

    // 가장 최근 PP 입력 1건 (페이지 복원용)
    async function loadLastPpEntry(instrumentId) {
        let q = client
            .from(TBL_PP)
            .select('*')
            .eq('tenant_id', getTenantId())
            .order('target_date', { ascending: false })
            .order('created_at',  { ascending: false })
            .limit(1);

        if (instrumentId) {
            q = q.eq('instrument_id', instrumentId);
        }

        const { data, error } = await q;
        if (error) throw error;
        return data && data.length > 0 ? rowToPpEntry(data[0]) : null;
    }

    // 이력 목록 조회 (날짜 내림차순)
    async function listPpEntries({ instrumentId = null, limit = 30 } = {}) {
        let q = client
            .from(TBL_PP)
            .select('*, stocks_instruments(ticker, name)')
            .eq('tenant_id', getTenantId())
            .order('target_date', { ascending: false })
            .order('created_at',  { ascending: false })
            .limit(limit);

        if (instrumentId) {
            q = q.eq('instrument_id', instrumentId);
        }

        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map(rowToPpEntry);
    }

    // PP 항목 저장 (upsert — 같은 날짜·종목이면 덮어쓰기)
    async function savePpEntry(entry) {
        const tenantId = getTenantId();
        const row = {
            id:            entry.id || genId('pp'),
            tenant_id:     tenantId,
            instrument_id: entry.instrumentId || null,
            target_date:   entry.targetDate   || new Date().toISOString().slice(0, 10),
            high:          entry.high,
            low:           entry.low,
            close:         entry.close,
            pp:            entry.pp  ?? null,
            r1:            entry.r1  ?? null,
            r2:            entry.r2  ?? null,
            r3:            entry.r3  ?? null,
            r4:            entry.r4  ?? null,
            r5:            entry.r5  ?? null,
            s1:            entry.s1  ?? null,
            s2:            entry.s2  ?? null,
            s3:            entry.s3  ?? null,
            s4:            entry.s4  ?? null,
            s5:            entry.s5  ?? null,
            updated_at:    new Date().toISOString(),
        };
        const { error } = await client
            .from(TBL_PP)
            .upsert(row, { onConflict: 'tenant_id,id' });
        if (error) throw error;
        return row.id;
    }

    async function deletePpEntry(id) {
        const { error } = await client
            .from(TBL_PP)
            .delete()
            .eq('tenant_id', getTenantId())
            .eq('id', id);
        if (error) throw error;
    }

    // ─── Row → JS 변환 ────────────────────────────────────────────────

    function rowToInstrument(row) {
        return {
            id:        row.id,
            tenantId:  row.tenant_id,
            ticker:    row.ticker,
            name:      row.name,
            market:    row.market,
            note:      row.note,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    function rowToPpEntry(row) {
        const instrument = row.stocks_instruments || null;
        return {
            id:           row.id,
            tenantId:     row.tenant_id,
            instrumentId: row.instrument_id,
            ticker:       instrument ? instrument.ticker : null,
            instrumentName: instrument ? instrument.name : null,
            targetDate:   row.target_date,
            high:         Number(row.high),
            low:          Number(row.low),
            close:        Number(row.close),
            pp:           row.pp  != null ? Number(row.pp)  : null,
            r1:           row.r1  != null ? Number(row.r1)  : null,
            r2:           row.r2  != null ? Number(row.r2)  : null,
            r3:           row.r3  != null ? Number(row.r3)  : null,
            r4:           row.r4  != null ? Number(row.r4)  : null,
            r5:           row.r5  != null ? Number(row.r5)  : null,
            s1:           row.s1  != null ? Number(row.s1)  : null,
            s2:           row.s2  != null ? Number(row.s2)  : null,
            s3:           row.s3  != null ? Number(row.s3)  : null,
            s4:           row.s4  != null ? Number(row.s4)  : null,
            s5:           row.s5  != null ? Number(row.s5)  : null,
            createdAt:    row.created_at,
            updatedAt:    row.updated_at,
        };
    }

    // ─── localStorage 전용 폴백 (Supabase 없을 때) ───────────────────
    function makeLocalOnlyDb() {
        const LS_PP = 'stocks_pp_entries_local';

        function loadAll() {
            try { return JSON.parse(localStorage.getItem(LS_PP) || '[]'); }
            catch { return []; }
        }
        function saveAll(arr) {
            localStorage.setItem(LS_PP, JSON.stringify(arr));
        }

        return {
            isLocal: true,
            getTenantId,
            listInstruments:  async () => [],
            saveInstrument:   async () => null,
            deleteInstrument: async () => {},
            loadLastPpEntry: async () => {
                const all = loadAll();
                return all.length > 0 ? all[all.length - 1] : null;
            },
            listPpEntries: async ({ limit = 30 } = {}) => {
                return loadAll().slice(-limit).reverse();
            },
            savePpEntry: async (entry) => {
                const all = loadAll();
                const id = entry.id || genId('pp');
                const idx = all.findIndex(e => e.id === id);
                const row = { ...entry, id, updatedAt: new Date().toISOString() };
                if (idx >= 0) all[idx] = row; else all.push(row);
                saveAll(all);
                return id;
            },
            deletePpEntry: async (id) => {
                saveAll(loadAll().filter(e => e.id !== id));
            },
        };
    }

    // ─── 공개 API ────────────────────────────────────────────────────
    window.stocksDb = {
        isLocal: false,
        getTenantId,
        // 종목
        listInstruments,
        saveInstrument,
        deleteInstrument,
        // PP
        loadLastPpEntry,
        listPpEntries,
        savePpEntry,
        deletePpEntry,
    };

    console.log('[StocksDB] 초기화 완료 — tenant_id:', getTenantId());
})();
