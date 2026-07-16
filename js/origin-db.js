// =============== origin-db.js ===============
// 대항해시대 오리진 교역소 타이머 ↔ Supabase origin_trade_posts
// 항구 핀 좌표 ↔ Supabase origin_pin_overrides
// 교역품 평시 수량 ↔ Supabase origin_good_plain_qty
// tenant_id: BETHEL_TENANT_ID (app_storage, d3_scripts와 공통)

(function () {
    'use strict';

    const TENANT_KEY        = 'BETHEL_TENANT_ID';
    const DEFAULT_TENANT_ID = 'default';
    const TBL               = 'origin_trade_posts';
    const TBL_PINS          = 'origin_pin_overrides';
    const TBL_QTY           = 'origin_good_plain_qty';
    const LS_KEY            = 'origin_trade_posts_v1';
    const LS_PIN_KEY        = 'origin_pin_overrides_v1';
    const LS_QTY_KEY        = 'origin_good_plain_qty_v1';

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
            soldOut:     !!row.sold_out,
            soldOutAt:   row.sold_out_at || null,
            toolShopBought: !!row.tool_shop_bought,
            toolShopBoughtAt: row.tool_shop_bought_at || null,
            syncedAt:    row.synced_at || null,
            syncedElapsedMin: row.synced_elapsed_min != null
                ? Number(row.synced_elapsed_min)
                : null,
            createdAt:   row.created_at,
            updatedAt:   row.updated_at,
        };
    }

    function rowToGoodQty(row) {
        return {
            tenantId:  row.tenant_id,
            portName:  row.port_name,
            goodName:  row.good_name,
            plainQty:  Number(row.plain_qty) || 0,
            updatedAt: row.updated_at,
        };
    }

    function toIsoOrNull(v) {
        if (v == null || v === '') return null;
        if (v instanceof Date) return v.toISOString();
        return v;
    }

    function toIntOrNull(v) {
        if (v == null || v === '') return null;
        const n = Number(v);
        return Number.isFinite(n) ? Math.trunc(n) : null;
    }

    function normalizePinData(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
        return raw;
    }

    function readLocalPins() {
        try {
            const raw = localStorage.getItem(LS_PIN_KEY);
            if (!raw) return {};
            return normalizePinData(JSON.parse(raw));
        } catch {
            return {};
        }
    }

    function writeLocalPins(data) {
        localStorage.setItem(LS_PIN_KEY, JSON.stringify(normalizePinData(data)));
    }

    function isEmptyPins(data) {
        return !data || Object.keys(data).length === 0;
    }

    /** @returns {Record<string, Record<string, number>>} port -> good -> plainQty */
    function readLocalQtys() {
        try {
            const raw = localStorage.getItem(LS_QTY_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
        } catch {
            return {};
        }
    }

    function writeLocalQtys(data) {
        localStorage.setItem(LS_QTY_KEY, JSON.stringify(data || {}));
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
            sold_out:     !!port.soldOut,
            sold_out_at:  port.soldOut
                ? (port.soldOutAt instanceof Date
                    ? port.soldOutAt.toISOString()
                    : (port.soldOutAt || new Date().toISOString()))
                : null,
            tool_shop_bought: !!port.toolShopBought,
            tool_shop_bought_at: port.toolShopBought
                ? (port.toolShopBoughtAt instanceof Date
                    ? port.toolShopBoughtAt.toISOString()
                    : (port.toolShopBoughtAt || new Date().toISOString()))
                : null,
            synced_at:    toIsoOrNull(port.syncedAt),
            synced_elapsed_min: toIntOrNull(port.syncedElapsedMin),
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

    /** @returns {Promise<Record<string, Record<string, {x:number,y:number}>>>} */
    async function loadPinOverrides() {
        const tenantId = getTenantId();
        const { data, error } = await client
            .from(TBL_PINS)
            .select('data')
            .eq('tenant_id', tenantId)
            .maybeSingle();
        if (error) throw error;

        let pins = normalizePinData(data && data.data);
        if (isEmptyPins(pins)) {
            const local = readLocalPins();
            if (!isEmptyPins(local)) {
                await savePinOverrides(local);
                pins = local;
            }
        } else {
            writeLocalPins(pins);
        }
        return pins;
    }

    /** @param {Record<string, Record<string, {x:number,y:number}>>} pinData */
    async function savePinOverrides(pinData) {
        const tenantId = getTenantId();
        const normalized = normalizePinData(pinData);
        writeLocalPins(normalized);
        const row = {
            tenant_id:  tenantId,
            data:       normalized,
            updated_at: new Date().toISOString(),
        };
        const { error } = await client
            .from(TBL_PINS)
            .upsert(row, { onConflict: 'tenant_id' });
        if (error) throw error;
    }

    /**
     * @param {string} [portName]
     * @returns {Promise<{ portName: string, goodName: string, plainQty: number, updatedAt?: string }[]>}
     */
    async function listGoodPlainQtys(portName) {
        let q = client
            .from(TBL_QTY)
            .select('*')
            .eq('tenant_id', getTenantId());
        if (portName) q = q.eq('port_name', portName);
        const { data, error } = await q.order('good_name', { ascending: true });
        if (error) throw error;
        return (data || []).map(rowToGoodQty);
    }

    /**
     * @param {{ portName: string, goodName: string, plainQty: number }} item
     */
    async function saveGoodPlainQty(item) {
        const portName = (item.portName || '').trim();
        const goodName = (item.goodName || '').trim();
        if (!portName || !goodName) throw new Error('항구/교역품명이 필요합니다.');
        const plainQty = Number(item.plainQty);
        if (!Number.isFinite(plainQty) || plainQty < 0) {
            throw new Error('수량이 올바르지 않습니다.');
        }
        if (plainQty === 0) {
            return deleteGoodPlainQty(portName, goodName);
        }
        const row = {
            tenant_id:  getTenantId(),
            port_name:  portName,
            good_name:  goodName,
            plain_qty:  plainQty,
            updated_at: new Date().toISOString(),
        };
        const { error } = await client
            .from(TBL_QTY)
            .upsert(row, { onConflict: 'tenant_id,port_name,good_name' });
        if (error) throw error;

        const local = readLocalQtys();
        if (!local[portName]) local[portName] = {};
        local[portName][goodName] = plainQty;
        writeLocalQtys(local);
    }

    async function deleteGoodPlainQty(portName, goodName) {
        const p = (portName || '').trim();
        const g = (goodName || '').trim();
        const { error } = await client
            .from(TBL_QTY)
            .delete()
            .eq('tenant_id', getTenantId())
            .eq('port_name', p)
            .eq('good_name', g);
        if (error) throw error;
        const local = readLocalQtys();
        if (local[p]) {
            delete local[p][g];
            if (!Object.keys(local[p]).length) delete local[p];
            writeLocalQtys(local);
        }
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
                const prev = all.find(e => e.id === id);
                const soldOut = port.soldOut != null ? !!port.soldOut : !!(prev && prev.soldOut);
                const toolShopBought = port.toolShopBought != null
                    ? !!port.toolShopBought
                    : !!(prev && prev.toolShopBought);
                const row = {
                    id,
                    tenantId: getTenantId(),
                    portName: (port.portName || '').trim(),
                    anchorAt: port.anchorAt instanceof Date
                        ? port.anchorAt.toISOString()
                        : port.anchorAt,
                    intervalMin: port.intervalMin ?? 30,
                    soldOut,
                    soldOutAt: soldOut
                        ? (port.soldOutAt instanceof Date
                            ? port.soldOutAt.toISOString()
                            : (port.soldOutAt || (prev && prev.soldOutAt) || new Date().toISOString()))
                        : null,
                    toolShopBought,
                    toolShopBoughtAt: toolShopBought
                        ? (port.toolShopBoughtAt instanceof Date
                            ? port.toolShopBoughtAt.toISOString()
                            : (port.toolShopBoughtAt || (prev && prev.toolShopBoughtAt) || new Date().toISOString()))
                        : null,
                    syncedAt: port.syncedAt !== undefined
                        ? toIsoOrNull(port.syncedAt)
                        : ((prev && prev.syncedAt) || null),
                    syncedElapsedMin: port.syncedElapsedMin !== undefined
                        ? toIntOrNull(port.syncedElapsedMin)
                        : ((prev && prev.syncedElapsedMin != null) ? prev.syncedElapsedMin : null),
                    updatedAt: new Date().toISOString(),
                    createdAt: (prev && prev.createdAt) || port.createdAt || new Date().toISOString(),
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
            loadPinOverrides: async () => readLocalPins(),
            savePinOverrides: async (pinData) => {
                writeLocalPins(pinData);
            },
            listGoodPlainQtys: async (portName) => {
                const all = readLocalQtys();
                const out = [];
                const ports = portName ? [portName] : Object.keys(all);
                for (const p of ports) {
                    const goods = all[p] || {};
                    for (const g of Object.keys(goods)) {
                        out.push({
                            portName: p,
                            goodName: g,
                            plainQty: Number(goods[g]) || 0,
                        });
                    }
                }
                out.sort((a, b) => a.goodName.localeCompare(b.goodName, 'ko'));
                return out;
            },
            saveGoodPlainQty: async (item) => {
                const portName = (item.portName || '').trim();
                const goodName = (item.goodName || '').trim();
                const plainQty = Number(item.plainQty);
                if (!portName || !goodName) throw new Error('항구/교역품명이 필요합니다.');
                const local = readLocalQtys();
                if (!Number.isFinite(plainQty) || plainQty <= 0) {
                    if (local[portName]) {
                        delete local[portName][goodName];
                        if (!Object.keys(local[portName]).length) delete local[portName];
                    }
                } else {
                    if (!local[portName]) local[portName] = {};
                    local[portName][goodName] = plainQty;
                }
                writeLocalQtys(local);
            },
            deleteGoodPlainQty: async (portName, goodName) => {
                const local = readLocalQtys();
                const p = (portName || '').trim();
                const g = (goodName || '').trim();
                if (local[p]) {
                    delete local[p][g];
                    if (!Object.keys(local[p]).length) delete local[p];
                    writeLocalQtys(local);
                }
            },
        };
    }

    window.originDb = {
        isLocal: false,
        getTenantId,
        listPorts,
        savePort,
        deletePort,
        loadPinOverrides,
        savePinOverrides,
        listGoodPlainQtys,
        saveGoodPlainQty,
        deleteGoodPlainQty,
    };

    console.log('[OriginDB] 초기화 완료 — tenant_id:', getTenantId());
})();
