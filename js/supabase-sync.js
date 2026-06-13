// =============== supabase-sync.js ===============
// localStorage ↔ Supabase app_storage 동기화 (BethelSoftLab 전용)
// 벧엘CM 패턴 기반 — 로그인 없이 자동 생성 tenant_id 사용

(function () {
    'use strict';

    const client = window.supabaseClient;
    if (!client) {
        console.warn('[SoftLab-Sync] Supabase 클라이언트 없음 — localStorage 전용 모드');
        window.supabaseSyncReady = Promise.resolve();
        return;
    }

    const TABLE = 'app_storage';

    // ✅ tenant_id: 없으면 default 고정 (도메인/기기 공통)
    const TENANT_KEY = 'BETHEL_TENANT_ID';
    const DEFAULT_TENANT_ID = 'default';
    function getTenantId() {
        let id = localStorage.getItem(TENANT_KEY);
        if (id && !id.startsWith('softlab-')) return id;

        // 벧엘CM 학원 ID가 있으면 그것을 우선 사용
        const session = sessionStorage.getItem('auth_academy');
        if (session) {
            try {
                const academy = JSON.parse(session);
                if (academy && academy.id) {
                    id = academy.id;
                    localStorage.setItem(TENANT_KEY, id);
                    return id;
                }
            } catch (_) {}
        }

        id = DEFAULT_TENANT_ID;
        localStorage.setItem(TENANT_KEY, id);
        return id;
    }

    // ✅ 동기화 대상 키 목록 (이 키들만 Supabase에 저장)
    const SYNC_KEYS = new Set(['SETTINGS_HOLIDAYS']);

    // ✅ 원본 localStorage 함수 보존 (오버라이드 전)
    const native = {
        getItem: Storage.prototype.getItem.bind(localStorage),
        setItem: Storage.prototype.setItem.bind(localStorage),
        removeItem: Storage.prototype.removeItem.bind(localStorage),
        key: Storage.prototype.key.bind(localStorage),
    };

    let isHydrating = true;
    const upsertQueue = new Map();
    const deleteQueue = new Set();
    let flushTimer = null;

    function scheduleFlush() {
        if (flushTimer) return;
        flushTimer = setTimeout(flushQueue, 1500);
    }

    async function flushQueue() {
        const upserts = Array.from(upsertQueue.entries());
        const deletes = Array.from(deleteQueue.values());
        upsertQueue.clear();
        deleteQueue.clear();
        flushTimer = null;

        if (!upserts.length && !deletes.length) return;

        const tenantId = getTenantId();

        if (upserts.length) {
            const rows = upserts.map(([key, value]) => ({
                tenant_id: tenantId,
                key,
                value,
                updated_at: new Date().toISOString(),
            }));
            const { error } = await client.from(TABLE).upsert(rows, { onConflict: 'tenant_id,key' });
            if (error) console.warn('[SoftLab-Sync] 저장 실패:', error.message);
            else console.log('[SoftLab-Sync] 저장 완료:', upserts.map(([k]) => k));
        }

        if (deletes.length) {
            const { error } = await client.from(TABLE).delete()
                .eq('tenant_id', tenantId).in('key', deletes);
            if (error) console.warn('[SoftLab-Sync] 삭제 실패:', error.message);
        }
    }

    // ✅ localStorage 오버라이드 — 동기화 대상 키만 큐에 추가
    localStorage.setItem = function (key, value) {
        native.setItem(key, value);
        if (!isHydrating && SYNC_KEYS.has(key)) {
            deleteQueue.delete(key);
            upsertQueue.set(key, value);
            scheduleFlush();
        }
    };

    localStorage.removeItem = function (key) {
        native.removeItem(key);
        if (!isHydrating && SYNC_KEYS.has(key)) {
            upsertQueue.delete(key);
            deleteQueue.add(key);
            scheduleFlush();
        }
    };

    // ✅ 앱 시작 시 Supabase → localStorage hydration
    window.supabaseSyncReady = (async () => {
        try {
            const tenantId = getTenantId();
            console.log('[SoftLab-Sync] 동기화 시작 — tenant_id:', tenantId);

            const { data, error } = await client.from(TABLE)
                .select('key, value')
                .eq('tenant_id', tenantId)
                .in('key', Array.from(SYNC_KEYS));

            if (error) throw error;

            if (Array.isArray(data) && data.length > 0) {
                // Supabase 데이터 우선 — localStorage에 덮어쓰기
                data.forEach(row => {
                    if (row && row.key != null) {
                        native.setItem(row.key, row.value ?? '');
                    }
                });
                console.log('[SoftLab-Sync] 원격 데이터 로드 완료:', data.map(r => r.key));
            } else {
                // Supabase에 없음 → 로컬 데이터 업로드
                const rows = [];
                SYNC_KEYS.forEach(key => {
                    const value = native.getItem(key);
                    if (value != null) {
                        rows.push({ tenant_id: tenantId, key, value, updated_at: new Date().toISOString() });
                    }
                });
                if (rows.length) {
                    const { error: upErr } = await client.from(TABLE).upsert(rows, { onConflict: 'tenant_id,key' });
                    if (upErr) throw upErr;
                    console.log('[SoftLab-Sync] 로컬 데이터 업로드 완료:', rows.map(r => r.key));
                } else {
                    console.log('[SoftLab-Sync] 동기화할 로컬 데이터 없음 (첫 사용)');
                }
            }
        } catch (err) {
            console.warn('[SoftLab-Sync] 초기 동기화 오류 (오프라인일 수 있음):', err.message || err);
        } finally {
            isHydrating = false;
        }
    })();

    // 페이지 종료 전 남은 큐 강제 flush
    window.addEventListener('beforeunload', () => flushQueue());

    // 외부에서 강제 flush
    window.flushSupabaseSync = async function () {
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
        await flushQueue();
    };

    window.nativeLocalStorage = native;
})();
