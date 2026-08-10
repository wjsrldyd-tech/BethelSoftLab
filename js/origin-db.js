// =============== origin-db.js ===============
// 대항해시대 오리진 교역소 타이머 ↔ Supabase origin_trade_posts
// 항구 핀 좌표 ↔ Supabase origin_pin_overrides
// 교역품 평시 수량 ↔ Supabase origin_good_plain_qty
// 앱 설정 ↔ Supabase origin_settings
// 물물교환 판매 기록 ↔ Supabase origin_barter_sales
// tenant_id: BETHEL_TENANT_ID (app_storage, d3_scripts와 공통)
//
// ── 저장 원칙: 로컬이 주(主), DB는 보조 ──────────────────────────────
// 모든 쓰기는 localStorage에 즉시 반영하고 함수는 곧바로 반환한다.
// 실제 Supabase 전송은 dirty 큐에 쌓아 디바운스(수백ms) 후 백그라운드로 flush.
// 읽기(list/load)는 DB를 조회하되, 아직 flush되지 않은 로컬 변경(dirty)이
// 있으면 그 값을 우선한다 — 화면·타이밍은 항상 로컬을 기준으로 맞는다.

(function () {
    'use strict';

    const TENANT_KEY        = 'BETHEL_TENANT_ID';
    const DEFAULT_TENANT_ID = 'default';
    const TBL               = 'origin_trade_posts';
    const TBL_PINS          = 'origin_pin_overrides';
    const TBL_QTY           = 'origin_good_plain_qty';
    const TBL_SETTINGS      = 'origin_settings';
    const TBL_SALES         = 'origin_barter_sales';
    const LS_KEY            = 'origin_trade_posts_v1';
    const LS_PORTS_CACHE_KEY = 'origin_trade_posts_cache_v1';
    const LS_PIN_KEY        = 'origin_pin_overrides_v1';
    const LS_QTY_KEY        = 'origin_good_plain_qty_v1';
    const LS_SETTINGS_KEY   = 'origin_settings_v1';
    const LS_SALES_KEY      = 'origin_barter_sales_v1';
    const DEFAULT_DRIFT_OVER_MIN = 1200;

    // 백그라운드 동기화 타이밍
    const FLUSH_DEBOUNCE_MS = 900;
    const FLUSH_SAFETY_INTERVAL_MS = 20000;

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

    /** PostgREST 신규 테이블 미반영(404 / PGRST205) 여부 */
    function isMissingRelationError(err) {
        if (!err) return false;
        const code = String(err.code || err.status || '');
        const msg = String(err.message || err.details || err.hint || '').toLowerCase();
        if (code === 'PGRST205' || code === '42P01' || code === '404') return true;
        if (msg.indexOf('could not find the table') !== -1) return true;
        if (msg.indexOf('does not exist') !== -1 && msg.indexOf('schema cache') !== -1) return true;
        if (msg.indexOf('relation') !== -1 && msg.indexOf('does not exist') !== -1) return true;
        return false;
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

    const DEFAULT_GLOBAL_OFFSET_SEC = 0;
    const OFFSET_SEC_MIN = -120;
    const OFFSET_SEC_MAX = 120;

    function normalizeSettings(raw) {
        const out = {};
        const src = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
        let drift = parseInt(src.driftOverMin, 10);
        if (!Number.isFinite(drift) || drift < 60) drift = DEFAULT_DRIFT_OVER_MIN;
        if (drift > 100000) drift = 100000;
        out.driftOverMin = drift;
        out.driftEnabled = src.driftEnabled !== false && src.driftEnabled !== 0 && src.driftEnabled !== '0';
        let offset = parseInt(src.globalOffsetSec, 10);
        if (!Number.isFinite(offset)) offset = DEFAULT_GLOBAL_OFFSET_SEC;
        if (offset < OFFSET_SEC_MIN) offset = OFFSET_SEC_MIN;
        if (offset > OFFSET_SEC_MAX) offset = OFFSET_SEC_MAX;
        out.globalOffsetSec = offset;
        out.offsetEnabled = src.offsetEnabled !== false && src.offsetEnabled !== 0 && src.offsetEnabled !== '0';
        return out;
    }

    function isDefaultSettings(s) {
        return !!s
            && s.driftOverMin === DEFAULT_DRIFT_OVER_MIN
            && s.driftEnabled === true
            && s.globalOffsetSec === DEFAULT_GLOBAL_OFFSET_SEC
            && s.offsetEnabled === true;
    }

    function readLocalSettings() {
        try {
            const raw = localStorage.getItem(LS_SETTINGS_KEY);
            if (!raw) return normalizeSettings({});
            return normalizeSettings(JSON.parse(raw));
        } catch {
            return normalizeSettings({});
        }
    }

    function writeLocalSettings(data) {
        localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(normalizeSettings(data)));
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
            shipyardBought: !!row.shipyard_bought,
            shipyardBoughtAt: row.shipyard_bought_at || null,
            employeeQuestDone: !!row.employee_quest_done,
            employeeQuestDoneAt: row.employee_quest_done_at || null,
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

    function rowToBarterSale(row) {
        return {
            id:         row.id,
            tenantId:   row.tenant_id,
            goodName:   row.good_name,
            portName:   row.port_name,
            marketPct:  Number(row.market_pct),
            salePrice:  Number(row.sale_price),
            unitPrice:  Number(row.unit_price),
            soldAt:     row.sold_at,
            updatedAt:  row.updated_at,
        };
    }

    function calcBarterUnitPrice(salePrice, marketPct) {
        const sale = Number(salePrice);
        const pct = Number(marketPct);
        if (!Number.isFinite(sale) || sale <= 0) return 0;
        if (!Number.isFinite(pct) || pct <= 0) return 0;
        // 단가 = 판매가 ÷ (시세%/100) → 소수점 반올림
        return Math.round((sale * 100) / pct);
    }

    // ─── localStorage 헬퍼 ──────────────────────────────────────────

    function readLocalSales() {
        try {
            const raw = localStorage.getItem(LS_SALES_KEY);
            if (!raw) return [];
            const list = JSON.parse(raw);
            return Array.isArray(list) ? list : [];
        } catch {
            return [];
        }
    }

    function writeLocalSales(list) {
        localStorage.setItem(LS_SALES_KEY, JSON.stringify(Array.isArray(list) ? list : []));
    }

    function upsertLocalSale(sale) {
        const list = readLocalSales().filter(s => s.id !== sale.id);
        list.push(sale);
        list.sort((a, b) => String(b.soldAt || '').localeCompare(String(a.soldAt || '')));
        writeLocalSales(list);
    }

    function removeLocalSale(id) {
        writeLocalSales(readLocalSales().filter(s => s.id !== id));
    }

    function listLocalBarterSales(opts) {
        const goodName = opts && opts.goodName ? String(opts.goodName).trim() : '';
        const portName = opts && opts.portName ? String(opts.portName).trim() : '';
        const limit = opts && opts.limit > 0 ? Math.min(Math.trunc(opts.limit), 500) : 100;
        let list = readLocalSales().slice();
        if (goodName) list = list.filter(s => s.goodName === goodName);
        if (portName) list = list.filter(s => s.portName === portName);
        list.sort((a, b) => String(b.soldAt || '').localeCompare(String(a.soldAt || '')));
        return list.slice(0, limit).map(s => ({
            id: s.id,
            goodName: s.goodName,
            portName: s.portName,
            marketPct: Number(s.marketPct),
            salePrice: Number(s.salePrice),
            unitPrice: Number(s.unitPrice),
            soldAt: s.soldAt,
            updatedAt: s.updatedAt,
        }));
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

    function qtyKey(portName, goodName) {
        return portName + '\u0000' + goodName;
    }

    function listLocalQtys(portName) {
        const all = readLocalQtys();
        const out = [];
        const ports = portName ? [portName] : Object.keys(all);
        for (const p of ports) {
            const goods = all[p] || {};
            for (const g of Object.keys(goods)) {
                out.push({ portName: p, goodName: g, plainQty: Number(goods[g]) || 0 });
            }
        }
        out.sort((a, b) => a.goodName.localeCompare(b.goodName, 'ko'));
        return out;
    }

    function readLocalPortsCache() {
        try {
            const raw = localStorage.getItem(LS_PORTS_CACHE_KEY);
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch {
            return [];
        }
    }

    function writeLocalPortsCache(list) {
        localStorage.setItem(LS_PORTS_CACHE_KEY, JSON.stringify(Array.isArray(list) ? list : []));
    }

    function upsertLocalPortsCache(row) {
        const all = readLocalPortsCache();
        const idx = all.findIndex(p => p.id === row.id);
        if (idx >= 0) all[idx] = row;
        else all.push(row);
        writeLocalPortsCache(all);
        return row;
    }

    function removeLocalPortsCache(id) {
        writeLocalPortsCache(readLocalPortsCache().filter(p => p.id !== id));
    }

    function findLocalPortByName(name) {
        return readLocalPortsCache().find(p => p.portName === name) || null;
    }

    /** 항구 로컬 행 빌더 — 신규 필드는 이전 값을 유지, camelCase(로컬)로 통일 */
    function buildPortLocalRow(port, prev, tenantId) {
        const portName = (port.portName || (prev && prev.portName) || '').trim();
        const soldOut = port.soldOut != null ? !!port.soldOut : !!(prev && prev.soldOut);
        const toolShopBought = port.toolShopBought != null ? !!port.toolShopBought : !!(prev && prev.toolShopBought);
        const shipyardBought = port.shipyardBought != null ? !!port.shipyardBought : !!(prev && prev.shipyardBought);
        const employeeQuestDone = port.employeeQuestDone != null
            ? !!port.employeeQuestDone
            : !!(prev && prev.employeeQuestDone);
        return {
            id: port.id,
            tenantId: tenantId || getTenantId(),
            portName,
            anchorAt: port.anchorAt instanceof Date
                ? port.anchorAt.toISOString()
                : (port.anchorAt || (prev && prev.anchorAt) || new Date().toISOString()),
            intervalMin: port.intervalMin ?? (prev && prev.intervalMin) ?? 30,
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
            shipyardBought,
            shipyardBoughtAt: shipyardBought
                ? (port.shipyardBoughtAt instanceof Date
                    ? port.shipyardBoughtAt.toISOString()
                    : (port.shipyardBoughtAt || (prev && prev.shipyardBoughtAt) || new Date().toISOString()))
                : null,
            employeeQuestDone,
            employeeQuestDoneAt: employeeQuestDone
                ? (port.employeeQuestDoneAt instanceof Date
                    ? port.employeeQuestDoneAt.toISOString()
                    : (port.employeeQuestDoneAt || (prev && prev.employeeQuestDoneAt) || new Date().toISOString()))
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
    }

    const client = window.supabaseClient;

    if (!client) {
        console.warn('[OriginDB] Supabase 클라이언트 없음 — localStorage 전용 모드');
        window.originDb = makeLocalOnlyDb();
        return;
    }

    // ─── dirty 큐 (로컬 쓰기 완료, DB 미반영) ───────────────────────

    const DIRTY_PORTS = new Map();          // id -> local row
    const DIRTY_PORT_DELETES = new Set();   // id
    const DIRTY_QTY = new Map();            // key -> { portName, goodName, plainQty, isDelete }
    const DIRTY_SALES = new Map();          // id -> sale
    const DIRTY_SALE_DELETES = new Set();   // id
    let dirtySettings = null;               // normalized settings object | null
    let dirtyPins = null;                   // normalized pin data | null

    let flushTimer = null;
    let flushInFlight = false;
    let flushQueued = false;

    function anyDirty() {
        return DIRTY_PORTS.size > 0 || DIRTY_PORT_DELETES.size > 0
            || DIRTY_QTY.size > 0
            || DIRTY_SALES.size > 0 || DIRTY_SALE_DELETES.size > 0
            || dirtySettings != null || dirtyPins != null;
    }

    function scheduleFlush(delayMs) {
        if (flushTimer) clearTimeout(flushTimer);
        flushTimer = setTimeout(() => {
            flushTimer = null;
            flushDirty();
        }, delayMs != null ? delayMs : FLUSH_DEBOUNCE_MS);
    }

    async function flushPortsDirty() {
        const entries = Array.from(DIRTY_PORTS.entries());
        for (const [id, row] of entries) {
            const dbRow = {
                id,
                tenant_id: row.tenantId || getTenantId(),
                port_name: row.portName,
                anchor_at: row.anchorAt,
                interval_min: row.intervalMin ?? 30,
                sold_out: !!row.soldOut,
                sold_out_at: row.soldOutAt || null,
                tool_shop_bought: !!row.toolShopBought,
                tool_shop_bought_at: row.toolShopBoughtAt || null,
                shipyard_bought: !!row.shipyardBought,
                shipyard_bought_at: row.shipyardBoughtAt || null,
                employee_quest_done: !!row.employeeQuestDone,
                employee_quest_done_at: row.employeeQuestDoneAt || null,
                synced_at: toIsoOrNull(row.syncedAt),
                synced_elapsed_min: toIntOrNull(row.syncedElapsedMin),
                updated_at: row.updatedAt || new Date().toISOString(),
            };
            try {
                const { error } = await client.from(TBL).upsert(dbRow, { onConflict: 'tenant_id,id' });
                if (error) throw error;
                if (DIRTY_PORTS.get(id) === row) DIRTY_PORTS.delete(id);
            } catch (err) {
                console.warn('[OriginDB] 항구 동기화 실패 — 다음 저장 때 재시도', id, err);
            }
        }
    }

    async function flushPortDeletesDirty() {
        const ids = Array.from(DIRTY_PORT_DELETES);
        for (const id of ids) {
            try {
                const { error } = await client.from(TBL).delete()
                    .eq('tenant_id', getTenantId()).eq('id', id);
                if (error) throw error;
                DIRTY_PORT_DELETES.delete(id);
            } catch (err) {
                console.warn('[OriginDB] 항구 삭제 동기화 실패', id, err);
            }
        }
    }

    async function flushQtyDirty() {
        const entries = Array.from(DIRTY_QTY.entries());
        for (const [key, item] of entries) {
            try {
                if (item.isDelete) {
                    const { error } = await client.from(TBL_QTY).delete()
                        .eq('tenant_id', getTenantId())
                        .eq('port_name', item.portName)
                        .eq('good_name', item.goodName);
                    if (error) throw error;
                } else {
                    const row = {
                        tenant_id: getTenantId(),
                        port_name: item.portName,
                        good_name: item.goodName,
                        plain_qty: item.plainQty,
                        updated_at: new Date().toISOString(),
                    };
                    const { error } = await client.from(TBL_QTY)
                        .upsert(row, { onConflict: 'tenant_id,port_name,good_name' });
                    if (error) throw error;
                }
                if (DIRTY_QTY.get(key) === item) DIRTY_QTY.delete(key);
            } catch (err) {
                console.warn('[OriginDB] 수량 동기화 실패 — 다음 저장 때 재시도', key, err);
            }
        }
    }

    async function flushSettingsDirty() {
        if (!dirtySettings) return;
        const snapshot = dirtySettings;
        const row = {
            tenant_id: getTenantId(),
            data: snapshot,
            updated_at: new Date().toISOString(),
        };
        try {
            const { error } = await client.from(TBL_SETTINGS).upsert(row, { onConflict: 'tenant_id' });
            if (error) throw error;
            if (dirtySettings === snapshot) dirtySettings = null;
        } catch (err) {
            if (isMissingRelationError(err)) {
                console.warn('[OriginDB] origin_settings 미반영(404) — 로컬만 유지', err);
                if (dirtySettings === snapshot) dirtySettings = null;
            } else {
                console.warn('[OriginDB] 설정 동기화 실패 — 다음 저장 때 재시도', err);
            }
        }
    }

    async function flushPinsDirty() {
        if (!dirtyPins) return;
        const snapshot = dirtyPins;
        const row = {
            tenant_id: getTenantId(),
            data: snapshot,
            updated_at: new Date().toISOString(),
        };
        try {
            const { error } = await client.from(TBL_PINS).upsert(row, { onConflict: 'tenant_id' });
            if (error) throw error;
            if (dirtyPins === snapshot) dirtyPins = null;
        } catch (err) {
            console.warn('[OriginDB] 핀 좌표 동기화 실패 — 다음 저장 때 재시도', err);
        }
    }

    async function flushSalesDirty() {
        const entries = Array.from(DIRTY_SALES.entries());
        for (const [id, sale] of entries) {
            const row = {
                tenant_id: getTenantId(),
                id,
                good_name: sale.goodName,
                port_name: sale.portName,
                market_pct: sale.marketPct,
                sale_price: sale.salePrice,
                unit_price: sale.unitPrice,
                sold_at: sale.soldAt,
                updated_at: sale.updatedAt,
            };
            try {
                const { error } = await client.from(TBL_SALES).upsert(row, { onConflict: 'tenant_id,id' });
                if (error) throw error;
                if (DIRTY_SALES.get(id) === sale) DIRTY_SALES.delete(id);
            } catch (err) {
                if (isMissingRelationError(err)) {
                    console.warn('[OriginDB] origin_barter_sales 미반영(404) — 로컬만 유지', err);
                    if (DIRTY_SALES.get(id) === sale) DIRTY_SALES.delete(id);
                } else {
                    console.warn('[OriginDB] 판매기록 동기화 실패 — 다음 저장 때 재시도', id, err);
                }
            }
        }
    }

    async function flushSaleDeletesDirty() {
        const ids = Array.from(DIRTY_SALE_DELETES);
        for (const id of ids) {
            try {
                const { error } = await client.from(TBL_SALES).delete()
                    .eq('tenant_id', getTenantId()).eq('id', id);
                if (error) throw error;
                DIRTY_SALE_DELETES.delete(id);
            } catch (err) {
                if (isMissingRelationError(err)) {
                    DIRTY_SALE_DELETES.delete(id);
                } else {
                    console.warn('[OriginDB] 판매기록 삭제 동기화 실패', id, err);
                }
            }
        }
    }

    async function flushDirty() {
        if (flushInFlight) {
            flushQueued = true;
            return;
        }
        flushInFlight = true;
        try {
            await flushPortsDirty();
            await flushPortDeletesDirty();
            await flushQtyDirty();
            await flushSettingsDirty();
            await flushPinsDirty();
            await flushSalesDirty();
            await flushSaleDeletesDirty();
        } catch (err) {
            console.error('[OriginDB] flush 중 예기치 못한 오류', err);
        } finally {
            flushInFlight = false;
            if (flushQueued) {
                flushQueued = false;
                scheduleFlush(50);
            }
        }
    }

    // 보험: 놓친 dirty 항목을 주기적으로 재시도 + 탭 숨김/이탈 시 즉시 시도
    setInterval(() => {
        if (anyDirty()) flushDirty();
    }, FLUSH_SAFETY_INTERVAL_MS);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && anyDirty()) flushDirty();
    });
    window.addEventListener('pagehide', () => {
        if (anyDirty()) flushDirty();
    });

    // ─── 항구 타이머 ─────────────────────────────────────────────────

    function mergePortsWithLocal(dbList) {
        const localList = readLocalPortsCache();
        const localById = new Map(localList.map(p => [p.id, p]));
        const merged = [];
        const seen = new Set();
        for (const dbRow of dbList) {
            if (DIRTY_PORT_DELETES.has(dbRow.id)) continue; // 로컬에서 삭제 대기 중
            seen.add(dbRow.id);
            const local = localById.get(dbRow.id);
            if (DIRTY_PORTS.has(dbRow.id) && local) {
                merged.push(local); // 미동기화 로컬 변경 우선
                continue;
            }
            if (local && Date.parse(local.updatedAt || 0) > Date.parse(dbRow.updatedAt || 0)) {
                merged.push(local);
            } else {
                merged.push(dbRow);
            }
        }
        for (const local of localList) {
            if (seen.has(local.id) || DIRTY_PORT_DELETES.has(local.id)) continue;
            if (DIRTY_PORTS.has(local.id)) merged.push(local); // 아직 DB에 없는 신규 항목
        }
        merged.sort((a, b) => (a.portName || '').localeCompare(b.portName || '', 'ko'));
        writeLocalPortsCache(merged);
        return merged;
    }

    async function listPorts() {
        let dbList = null;
        try {
            const { data, error } = await client
                .from(TBL)
                .select('*')
                .eq('tenant_id', getTenantId())
                .order('port_name', { ascending: true });
            if (error) throw error;
            dbList = (data || []).map(rowToPort);
        } catch (err) {
            console.warn('[OriginDB] listPorts DB 조회 실패 — 로컬 캐시 사용', err);
        }
        if (!dbList) {
            return readLocalPortsCache().slice()
                .filter(p => !DIRTY_PORT_DELETES.has(p.id))
                .sort((a, b) => (a.portName || '').localeCompare(b.portName || '', 'ko'));
        }
        return mergePortsWithLocal(dbList);
    }

    /**
     * 로컬에 즉시 반영 후 곧바로 반환 — DB 전송은 백그라운드(dirty 큐)에서 처리.
     * @returns {Promise<object>} 로컬 저장 행 (camelCase)
     */
    async function savePort(port) {
        const tenantId = getTenantId();
        const portName = (port.portName || '').trim();
        const existingByName = !port.id ? findLocalPortByName(portName) : null;
        const id = port.id || (existingByName && existingByName.id) || genId('op');
        const prev = readLocalPortsCache().find(p => p.id === id) || null;
        const row = buildPortLocalRow({ ...port, id }, prev, tenantId);
        upsertLocalPortsCache(row);
        DIRTY_PORTS.set(id, row);
        DIRTY_PORT_DELETES.delete(id);
        scheduleFlush();
        return row;
    }

    async function deletePort(id) {
        removeLocalPortsCache(id);
        DIRTY_PORTS.delete(id);
        DIRTY_PORT_DELETES.add(id);
        scheduleFlush();
    }

    // ─── 핀 좌표 ─────────────────────────────────────────────────────

    /** @returns {Promise<Record<string, Record<string, {x:number,y:number}>>>} */
    async function loadPinOverrides() {
        if (dirtyPins) return dirtyPins; // 아직 반영 안 된 로컬 변경 우선
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
                dirtyPins = local;
                scheduleFlush();
                pins = local;
            }
        } else {
            writeLocalPins(pins);
        }
        return pins;
    }

    /** @param {Record<string, Record<string, {x:number,y:number}>>} pinData */
    async function savePinOverrides(pinData) {
        const normalized = normalizePinData(pinData);
        writeLocalPins(normalized);
        dirtyPins = normalized;
        scheduleFlush();
    }

    // ─── 앱 설정 ─────────────────────────────────────────────────────

    /**
     * @returns {Promise<{ driftOverMin: number, driftEnabled: boolean, globalOffsetSec: number, offsetEnabled: boolean, _fromLocal?: boolean }>}
     */
    async function loadSettings() {
        const tenantId = getTenantId();
        try {
            const { data, error } = await client
                .from(TBL_SETTINGS)
                .select('data')
                .eq('tenant_id', tenantId)
                .maybeSingle();
            if (error) throw error;

            const dbEmpty = !data || !data.data || Object.keys(data.data).length === 0;
            const local = readLocalSettings();

            if (dbEmpty) {
                if (!isDefaultSettings(local)) {
                    dirtySettings = local;
                    scheduleFlush();
                }
                return local;
            }

            if (dirtySettings) return dirtySettings; // 아직 반영 안 된 로컬 변경 우선
            const settings = normalizeSettings(data.data);
            writeLocalSettings(settings);
            return settings;
        } catch (err) {
            if (isMissingRelationError(err)) {
                console.warn('[OriginDB] origin_settings 미반영(404) — localStorage 사용. SQL 마이그레이션/스키마 Reload를 확인하세요.', err);
                return { ...readLocalSettings(), _fromLocal: true };
            }
            throw err;
        }
    }

    /**
     * @param {{ driftOverMin?: number, driftEnabled?: boolean, globalOffsetSec?: number, offsetEnabled?: boolean }} partial
     * @returns {Promise<{ driftOverMin: number, driftEnabled: boolean, globalOffsetSec: number, offsetEnabled: boolean }>}
     */
    async function saveSettings(partial) {
        const merged = normalizeSettings({ ...readLocalSettings(), ...(partial || {}) });
        writeLocalSettings(merged);
        dirtySettings = merged;
        scheduleFlush();
        return merged;
    }

    // ─── 교역품 평시 수량 ────────────────────────────────────────────

    /**
     * @param {string} [portName]
     * @returns {Promise<{ portName: string, goodName: string, plainQty: number, updatedAt?: string }[]>}
     */
    async function listGoodPlainQtys(portName) {
        const PAGE = 1000;
        let dbRows = null;
        try {
            const raw = [];
            let from = 0;
            for (;;) {
                let q = client
                    .from(TBL_QTY)
                    .select('*')
                    .eq('tenant_id', getTenantId());
                if (portName) q = q.eq('port_name', portName);
                // port+good 정렬로 range 페이지가 안정적으로 이어지게 함
                q = q
                    .order('port_name', { ascending: true })
                    .order('good_name', { ascending: true })
                    .range(from, from + PAGE - 1);
                const { data, error } = await q;
                if (error) throw error;
                const batch = data || [];
                raw.push.apply(raw, batch);
                if (batch.length < PAGE) break;
                from += PAGE;
            }
            dbRows = raw.map(rowToGoodQty);
        } catch (err) {
            console.warn('[OriginDB] listGoodPlainQtys DB 조회 실패 — 로컬 캐시 사용', err);
        }
        if (!dbRows) return listLocalQtys(portName);

        // dirty 오버레이: 아직 DB에 반영되지 않은 최신 로컬 값이 이긴다
        const map = new Map();
        for (const row of dbRows) map.set(qtyKey(row.portName, row.goodName), row);
        for (const [key, item] of DIRTY_QTY.entries()) {
            if (portName && item.portName !== portName) continue;
            if (item.isDelete) map.delete(key);
            else map.set(key, { portName: item.portName, goodName: item.goodName, plainQty: item.plainQty });
        }
        const result = Array.from(map.values()).sort((a, b) => a.goodName.localeCompare(b.goodName, 'ko'));

        // 로컬 캐시를 DB 최신값으로 맞추되, 대상 범위에서 dirty 값은 유지됨(map에 이미 반영)
        const local = readLocalQtys();
        if (portName) {
            local[portName] = {};
            for (const row of result) local[portName][row.goodName] = row.plainQty;
            if (!Object.keys(local[portName]).length) delete local[portName];
        } else {
            for (const key of Object.keys(local)) delete local[key];
            for (const row of result) {
                if (!local[row.portName]) local[row.portName] = {};
                local[row.portName][row.goodName] = row.plainQty;
            }
        }
        writeLocalQtys(local);
        return result;
    }

    /**
     * 로컬에 즉시 반영 후 곧바로 반환 — DB 전송은 백그라운드(dirty 큐)에서 처리.
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
        const key = qtyKey(portName, goodName);
        const local = readLocalQtys();
        if (plainQty === 0) {
            if (local[portName]) {
                delete local[portName][goodName];
                if (!Object.keys(local[portName]).length) delete local[portName];
            }
            writeLocalQtys(local);
            DIRTY_QTY.set(key, { portName, goodName, plainQty: 0, isDelete: true });
        } else {
            if (!local[portName]) local[portName] = {};
            local[portName][goodName] = plainQty;
            writeLocalQtys(local);
            DIRTY_QTY.set(key, { portName, goodName, plainQty, isDelete: false });
        }
        scheduleFlush();
    }

    async function deleteGoodPlainQty(portName, goodName) {
        const p = (portName || '').trim();
        const g = (goodName || '').trim();
        const local = readLocalQtys();
        if (local[p]) {
            delete local[p][g];
            if (!Object.keys(local[p]).length) delete local[p];
            writeLocalQtys(local);
        }
        DIRTY_QTY.set(qtyKey(p, g), { portName: p, goodName: g, plainQty: 0, isDelete: true });
        scheduleFlush();
    }

    // ─── 물물교환 판매 기록 ──────────────────────────────────────────

    /**
     * @param {{ goodName?: string, portName?: string, limit?: number }} [opts]
     * @returns {Promise<{ id: string, goodName: string, portName: string, marketPct: number, salePrice: number, unitPrice: number, soldAt: string }[]>}
     */
    async function listBarterSales(opts) {
        const goodName = opts && opts.goodName ? String(opts.goodName).trim() : '';
        const portName = opts && opts.portName ? String(opts.portName).trim() : '';
        const limit = opts && opts.limit > 0 ? Math.min(Math.trunc(opts.limit), 500) : 100;

        let q = client
            .from(TBL_SALES)
            .select('*')
            .eq('tenant_id', getTenantId())
            .order('sold_at', { ascending: false })
            .limit(limit);
        if (goodName) q = q.eq('good_name', goodName);
        if (portName) q = q.eq('port_name', portName);

        const { data, error } = await q;
        if (error) {
            if (isMissingRelationError(error)) {
                console.warn('[OriginDB] origin_barter_sales 미반영 — localStorage 사용', error);
                return listLocalBarterSales({ goodName, portName, limit });
            }
            throw error;
        }

        const byId = new Map((data || []).map(rowToBarterSale).map(r => [r.id, r]));
        for (const id of DIRTY_SALE_DELETES) byId.delete(id);
        for (const [id, sale] of DIRTY_SALES) {
            if (goodName && sale.goodName !== goodName) continue;
            if (portName && sale.portName !== portName) continue;
            byId.set(id, sale);
        }
        let rows = Array.from(byId.values());
        rows.sort((a, b) => String(b.soldAt || '').localeCompare(String(a.soldAt || '')));
        rows = rows.slice(0, limit);

        // 전체 목록 조회일 때만 로컬 캐시 동기화 (필터 조회 시 다른 기록 덮어쓰기 방지)
        if (!goodName && !portName) {
            writeLocalSales(rows.map(s => ({
                id: s.id,
                goodName: s.goodName,
                portName: s.portName,
                marketPct: s.marketPct,
                salePrice: s.salePrice,
                unitPrice: s.unitPrice,
                soldAt: s.soldAt,
                updatedAt: s.updatedAt,
            })));
        }
        return rows;
    }

    /**
     * 로컬에 즉시 반영 후 곧바로 반환 — DB 전송은 백그라운드(dirty 큐)에서 처리.
     * @param {{ id?: string, goodName: string, portName: string, marketPct: number, salePrice: number, soldAt?: string }} item
     */
    async function saveBarterSale(item) {
        const goodName = (item.goodName || '').trim();
        const portName = (item.portName || '').trim();
        if (!goodName) throw new Error('품목명이 필요합니다.');
        if (!portName) throw new Error('판매처(항구)가 필요합니다.');
        const marketPct = Number(item.marketPct);
        const salePrice = Number(item.salePrice);
        if (!Number.isFinite(marketPct) || marketPct <= 0) {
            throw new Error('시세(%)가 올바르지 않습니다.');
        }
        if (!Number.isFinite(salePrice) || salePrice <= 0) {
            throw new Error('판매가가 올바르지 않습니다.');
        }
        const unitPrice = calcBarterUnitPrice(salePrice, marketPct);
        const id = (item.id || '').trim() || genId('bs');
        const soldAt = item.soldAt
            ? (item.soldAt instanceof Date ? item.soldAt.toISOString() : String(item.soldAt))
            : new Date().toISOString();
        const updatedAt = new Date().toISOString();
        const sale = { id, goodName, portName, marketPct, salePrice, unitPrice, soldAt, updatedAt };

        upsertLocalSale(sale);
        DIRTY_SALES.set(id, sale);
        DIRTY_SALE_DELETES.delete(id);
        scheduleFlush();
        return sale;
    }

    async function deleteBarterSale(id) {
        const saleId = (id || '').trim();
        if (!saleId) throw new Error('기록 ID가 필요합니다.');
        removeLocalSale(saleId);
        DIRTY_SALES.delete(saleId);
        DIRTY_SALE_DELETES.add(saleId);
        scheduleFlush();
    }

    // ─── 로컬 전용 모드 (Supabase 미연결) ────────────────────────────

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
                const portName = (port.portName || '').trim();
                const existingByName = !port.id && portName
                    ? all.find(e => e.portName === portName)
                    : null;
                const id = port.id || (existingByName && existingByName.id) || genId('op');
                const prev = all.find(e => e.id === id) || null;
                const row = buildPortLocalRow({ ...port, id }, prev, getTenantId());
                const idx = all.findIndex(e => e.id === id);
                if (idx >= 0) all[idx] = row;
                else all.push(row);
                saveAll(all);
                return row;
            },
            deletePort: async (id) => {
                saveAll(loadAll().filter(e => e.id !== id));
            },
            loadPinOverrides: async () => readLocalPins(),
            savePinOverrides: async (pinData) => {
                writeLocalPins(pinData);
            },
            loadSettings: async () => readLocalSettings(),
            saveSettings: async (partial) => {
                const merged = normalizeSettings({ ...readLocalSettings(), ...(partial || {}) });
                writeLocalSettings(merged);
                return merged;
            },
            listGoodPlainQtys: async (portName) => listLocalQtys(portName),
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
            listBarterSales: async (opts) => listLocalBarterSales(opts || {}),
            saveBarterSale: async (item) => {
                const goodName = (item.goodName || '').trim();
                const portName = (item.portName || '').trim();
                if (!goodName) throw new Error('품목명이 필요합니다.');
                if (!portName) throw new Error('판매처(항구)가 필요합니다.');
                const marketPct = Number(item.marketPct);
                const salePrice = Number(item.salePrice);
                if (!Number.isFinite(marketPct) || marketPct <= 0) {
                    throw new Error('시세(%)가 올바르지 않습니다.');
                }
                if (!Number.isFinite(salePrice) || salePrice <= 0) {
                    throw new Error('판매가가 올바르지 않습니다.');
                }
                const unitPrice = calcBarterUnitPrice(salePrice, marketPct);
                const id = (item.id || '').trim() || genId('bs');
                const soldAt = item.soldAt
                    ? (item.soldAt instanceof Date ? item.soldAt.toISOString() : String(item.soldAt))
                    : new Date().toISOString();
                const sale = {
                    id,
                    goodName,
                    portName,
                    marketPct,
                    salePrice,
                    unitPrice,
                    soldAt,
                    updatedAt: new Date().toISOString(),
                };
                upsertLocalSale(sale);
                return sale;
            },
            deleteBarterSale: async (id) => {
                removeLocalSale((id || '').trim());
            },
            calcBarterUnitPrice,
            hasPendingWrites: () => false,
            flushPendingWrites: async () => {},
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
        loadSettings,
        saveSettings,
        listGoodPlainQtys,
        saveGoodPlainQty,
        deleteGoodPlainQty,
        listBarterSales,
        saveBarterSale,
        deleteBarterSale,
        calcBarterUnitPrice,
        hasPendingWrites: anyDirty,
        flushPendingWrites: flushDirty,
    };

    console.log('[OriginDB] 초기화 완료 — tenant_id:', getTenantId());
})();
