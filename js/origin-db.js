// =============== origin-db.js ===============
// 대항해시대 오리진 교역소 타이머 ↔ Supabase origin_trade_posts
// 항구 핀 좌표 ↔ Supabase origin_pin_overrides
// 교역품 평시 수량 ↔ Supabase origin_good_plain_qty
// 앱 설정 ↔ Supabase origin_settings
// 물물교환 판매 기록 ↔ Supabase origin_barter_sales
// tenant_id: BETHEL_TENANT_ID (app_storage, d3_scripts와 공통)

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
    const LS_PIN_KEY        = 'origin_pin_overrides_v1';
    const LS_QTY_KEY        = 'origin_good_plain_qty_v1';
    const LS_SETTINGS_KEY   = 'origin_settings_v1';
    const LS_SALES_KEY      = 'origin_barter_sales_v1';
    const DEFAULT_DRIFT_OVER_MIN = 1200;

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

    function normalizeSettings(raw) {
        const out = {};
        const src = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
        let drift = parseInt(src.driftOverMin, 10);
        if (!Number.isFinite(drift) || drift < 60) drift = DEFAULT_DRIFT_OVER_MIN;
        if (drift > 100000) drift = 100000;
        out.driftOverMin = drift;
        return out;
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
     * @returns {Promise<{ driftOverMin: number, _fromLocal?: boolean }>}
     */
    async function loadSettings() {
        const tenantId = getTenantId();
        const { data, error } = await client
            .from(TBL_SETTINGS)
            .select('data')
            .eq('tenant_id', tenantId)
            .maybeSingle();

        if (error) {
            if (isMissingRelationError(error)) {
                console.warn('[OriginDB] origin_settings 미반영(404) — localStorage 사용. SQL 마이그레이션/스키마 Reload를 확인하세요.', error);
                return { ...readLocalSettings(), _fromLocal: true };
            }
            throw error;
        }

        let settings = normalizeSettings(data && data.data);
        const local = readLocalSettings();
        const dbEmpty = !data || !data.data || Object.keys(data.data).length === 0;
        if (dbEmpty && local.driftOverMin !== DEFAULT_DRIFT_OVER_MIN) {
            try {
                await saveSettings(local);
                settings = local;
            } catch (e) {
                if (!isMissingRelationError(e)) throw e;
                return { ...local, _fromLocal: true };
            }
        } else {
            writeLocalSettings(settings);
        }
        return settings;
    }

    /**
     * @param {{ driftOverMin?: number }} partial
     * @returns {Promise<{ driftOverMin: number, _fromLocal?: boolean }>}
     */
    async function saveSettings(partial) {
        const tenantId = getTenantId();
        const merged = normalizeSettings({ ...readLocalSettings(), ...(partial || {}) });
        writeLocalSettings(merged);
        const row = {
            tenant_id:  tenantId,
            data:       merged,
            updated_at: new Date().toISOString(),
        };
        const { error } = await client
            .from(TBL_SETTINGS)
            .upsert(row, { onConflict: 'tenant_id' });
        if (error) {
            if (isMissingRelationError(error)) {
                console.warn('[OriginDB] origin_settings 저장 실패(404) — 로컬만 유지', error);
                return { ...merged, _fromLocal: true };
            }
            throw error;
        }
        return merged;
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

        const rows = (data || []).map(rowToBarterSale);
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
        const sale = {
            id,
            goodName,
            portName,
            marketPct,
            salePrice,
            unitPrice,
            soldAt,
            updatedAt,
        };
        upsertLocalSale(sale);

        const row = {
            tenant_id:   getTenantId(),
            id,
            good_name:   goodName,
            port_name:   portName,
            market_pct:  marketPct,
            sale_price:  salePrice,
            unit_price:  unitPrice,
            sold_at:     soldAt,
            updated_at:  updatedAt,
        };
        const { error } = await client
            .from(TBL_SALES)
            .upsert(row, { onConflict: 'tenant_id,id' });
        if (error) {
            if (isMissingRelationError(error)) {
                console.warn('[OriginDB] origin_barter_sales 저장 실패(404) — 로컬만 유지', error);
                return { ...sale, _fromLocal: true };
            }
            throw error;
        }
        return sale;
    }

    async function deleteBarterSale(id) {
        const saleId = (id || '').trim();
        if (!saleId) throw new Error('기록 ID가 필요합니다.');
        removeLocalSale(saleId);
        const { error } = await client
            .from(TBL_SALES)
            .delete()
            .eq('tenant_id', getTenantId())
            .eq('id', saleId);
        if (error) {
            if (isMissingRelationError(error)) {
                console.warn('[OriginDB] origin_barter_sales 삭제 실패(404) — 로컬만 반영', error);
                return;
            }
            throw error;
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
            loadSettings: async () => readLocalSettings(),
            saveSettings: async (partial) => {
                const merged = normalizeSettings({ ...readLocalSettings(), ...(partial || {}) });
                writeLocalSettings(merged);
                return merged;
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
    };

    console.log('[OriginDB] 초기화 완료 — tenant_id:', getTenantId());
})();
