// =============== origin-timer.js ===============
// 대항해시대 오리진 교역소 재고 타이머 UI
// 절대 시각(anchor_at) 기준 30분 주기 계산

(function () {
    'use strict';

    const INTERVAL_MIN = 30;
    const INTERVAL_MS  = INTERVAL_MIN * 60 * 1000;
    const DEFAULT_PORT = '오데사';

    const $ = (sel) => document.querySelector(sel);
    const listEl   = $('#ot-list');
    const statusEl = $('#ot-status');
    const nameInput = $('#ot-port-name');
    const addBtn   = $('#ot-add-btn');

    let ports = [];
    let tickTimer = null;

    // ─── 시간 계산 ───────────────────────────────────────────────────

    function parseAnchorMs(anchorAt) {
        const t = new Date(anchorAt).getTime();
        return Number.isFinite(t) ? t : Date.now();
    }

    function getNextResetMs(anchorAt, now = Date.now()) {
        const anchor = parseAnchorMs(anchorAt);
        const elapsed = Math.max(0, now - anchor);
        const cycles = Math.floor(elapsed / INTERVAL_MS);
        return anchor + (cycles + 1) * INTERVAL_MS;
    }

    function getRemainingMs(anchorAt, now = Date.now()) {
        return getNextResetMs(anchorAt, now) - now;
    }

    function formatCountdown(ms) {
        if (ms <= 0) return '00:00';
        const totalSec = Math.ceil(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function formatClock(ms) {
        const d = new Date(ms);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        return hh + ':' + mm + ':' + ss;
    }

    /** 남은 시간(MM:SS) → DB 저장용 anchor_at */
    function remainingToAnchor(remainingMs, now = Date.now()) {
        const nextReset = now + remainingMs;
        return new Date(nextReset - INTERVAL_MS).toISOString();
    }

    function parseRemainingInput(value) {
        if (!value || !String(value).trim()) return null;
        const v = String(value).trim();
        if (/^\d+$/.test(v)) {
            const mins = parseInt(v, 10);
            if (mins < 0 || mins > INTERVAL_MIN) return null;
            return mins * 60 * 1000;
        }
        const m = v.match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return null;
        const mins = parseInt(m[1], 10);
        const secs = parseInt(m[2], 10);
        if (secs >= 60 || mins < 0 || mins > INTERVAL_MIN) return null;
        if (mins === INTERVAL_MIN && secs > 0) return null;
        return (mins * 60 + secs) * 1000;
    }

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || '';
        statusEl.classList.toggle('is-error', !!isError);
    }

    // ─── 렌더 ────────────────────────────────────────────────────────

    function renderList() {
        if (!listEl) return;
        const now = Date.now();

        if (ports.length === 0) {
            listEl.innerHTML = '<p class="ot-empty">등록된 항구가 없습니다.</p>';
            return;
        }

        listEl.innerHTML = ports.map(port => {
            const rem = getRemainingMs(port.anchorAt, now);
            const next = getNextResetMs(port.anchorAt, now);
            const ready = rem <= 1000;
            const remVal = formatCountdown(rem);

            return `
            <article class="ot-card${ready ? ' is-ready' : ''}" data-id="${escapeAttr(port.id)}">
              <div class="ot-card-head">
                <h2 class="ot-port-name">${escapeHtml(port.portName)}</h2>
                <span class="ot-badge">${ready ? '재고 리셋됨' : '대기중'}</span>
              </div>

              <div class="ot-countdown-row">
                <div class="ot-countdown" data-role="countdown">${remVal}</div>
                <div class="ot-meta">
                  <div>다음 리셋 <strong data-role="next">${formatClock(next)}</strong></div>
                  <div class="ot-hint">${ready ? '구매 가능' : '후 재고 초기화'}</div>
                </div>
              </div>

              <div class="ot-field">
                <label class="ot-label" for="remain-${escapeAttr(port.id)}">남은 시간 (게임 기준)</label>
                <div class="ot-field-row">
                  <input type="text"
                    id="remain-${escapeAttr(port.id)}"
                    class="ot-input ot-input-remaining"
                    data-role="remaining"
                    inputmode="numeric"
                    placeholder="28:13"
                    value="${escapeAttr(remVal)}"
                    maxlength="5"
                    autocomplete="off" />
                  <button type="button" class="ot-btn ot-btn-ghost" data-action="sync">현재</button>
                  <button type="button" class="ot-btn ot-btn-primary" data-action="apply">적용</button>
                </div>
                <span class="ot-field-hint">MM:SS 형식 · 0:00 = 방금 리셋, 30:00 = 방금 입장</span>
              </div>

              <div class="ot-actions">
                <button type="button" class="ot-btn ot-btn-accent" data-action="gem-reset">재화 초기화</button>
                <button type="button" class="ot-btn ot-btn-danger" data-action="delete">삭제</button>
              </div>
            </article>`;
        }).join('');
    }

    function tickCountdowns() {
        const now = Date.now();
        listEl.querySelectorAll('.ot-card').forEach(card => {
            const id = card.dataset.id;
            const port = ports.find(p => p.id === id);
            if (!port) return;

            const rem = getRemainingMs(port.anchorAt, now);
            const next = getNextResetMs(port.anchorAt, now);
            const ready = rem <= 1000;

            const cd = card.querySelector('[data-role="countdown"]');
            const nx = card.querySelector('[data-role="next"]');
            const badge = card.querySelector('.ot-badge');
            const hint = card.querySelector('.ot-hint');

            if (cd) cd.textContent = formatCountdown(rem);
            if (nx) nx.textContent = formatClock(next);
            if (badge) badge.textContent = ready ? '재고 리셋됨' : '대기중';
            if (hint) hint.textContent = ready ? '구매 가능' : '후 재고 초기화';
            card.classList.toggle('is-ready', ready);
        });
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escapeAttr(s) {
        return escapeHtml(s).replace(/'/g, '&#39;');
    }

    // ─── 데이터 ──────────────────────────────────────────────────────

    async function ensureOdessa(list) {
        const has = list.some(p => p.portName === DEFAULT_PORT);
        if (has) return list;

        await window.originDb.savePort({
            portName: DEFAULT_PORT,
            anchorAt: new Date().toISOString(),
            intervalMin: INTERVAL_MIN,
        });
        setStatus(`「${DEFAULT_PORT}」항구를 추가했습니다.`);
        return window.originDb.listPorts();
    }

    async function reload() {
        try {
            let list = await window.originDb.listPorts();
            list = await ensureOdessa(list);
            ports = list;
            renderList();
            if (window.originDb.isLocal) {
                setStatus('로컬 저장 모드 (Supabase 미연결 또는 테이블 미생성)', false);
            }
        } catch (err) {
            console.error('[OriginTimer] 로드 실패', err);
            setStatus('불러오기 실패: ' + (err.message || err) + ' — SQL 마이그레이션을 확인하세요.', true);
            // 폴백: 테이블 없으면 local 모드처럼 오데사만 표시 시도는 하지 않고 안내
            ports = [];
            renderList();
        }
    }

    async function saveAnchor(id, iso) {
        const port = ports.find(p => p.id === id);
        if (!port) return;
        await window.originDb.savePort({
            ...port,
            anchorAt: iso,
            intervalMin: INTERVAL_MIN,
        });
        await reload();
        setStatus(`「${port.portName}」남은 시간을 반영했습니다.`);
    }

    // ─── 이벤트 ──────────────────────────────────────────────────────

    listEl.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const card = btn.closest('.ot-card');
        if (!card) return;
        const id = card.dataset.id;
        const action = btn.dataset.action;
        const port = ports.find(p => p.id === id);
        if (!port) return;

        try {
            if (action === 'sync') {
                const input = card.querySelector('[data-role="remaining"]');
                const rem = getRemainingMs(port.anchorAt);
                if (input) input.value = formatCountdown(rem);
                return;
            }

            if (action === 'apply') {
                const input = card.querySelector('[data-role="remaining"]');
                const remainingMs = parseRemainingInput(input && input.value);
                if (remainingMs == null) {
                    setStatus('남은 시간을 MM:SS 형식으로 입력하세요. (예: 10:30, 최대 30:00)', true);
                    return;
                }
                btn.disabled = true;
                const iso = remainingToAnchor(remainingMs);
                await saveAnchor(id, iso);
                return;
            }

            if (action === 'gem-reset') {
                if (!confirm(`「${port.portName}」재화로 재고를 초기화했습니까?\n30분 주기가 지금부터 다시 시작됩니다.`)) {
                    return;
                }
                btn.disabled = true;
                await saveAnchor(id, new Date().toISOString());
                setStatus(`「${port.portName}」재화 초기화 — 30분 주기를 지금부터 다시 시작합니다.`);
                return;
            }

            if (action === 'delete') {
                if (!confirm(`「${port.portName}」항구를 삭제할까요?`)) return;
                btn.disabled = true;
                await window.originDb.deletePort(id);
                await reload();
                setStatus(`「${port.portName}」을(를) 삭제했습니다.`);
            }
        } catch (err) {
            console.error(err);
            setStatus('저장 실패: ' + (err.message || err), true);
        } finally {
            btn.disabled = false;
        }
    });

    if (addBtn) {
        addBtn.addEventListener('click', async () => {
            const name = (nameInput.value || '').trim();
            if (!name) {
                setStatus('항구 이름을 입력하세요.', true);
                nameInput.focus();
                return;
            }
            try {
                addBtn.disabled = true;
                await window.originDb.savePort({
                    portName: name,
                    anchorAt: new Date().toISOString(),
                    intervalMin: INTERVAL_MIN,
                });
                nameInput.value = '';
                await reload();
                setStatus(`「${name}」항구를 추가했습니다. (지금 입장)`);
            } catch (err) {
                console.error(err);
                setStatus('추가 실패: ' + (err.message || err), true);
            } finally {
                addBtn.disabled = false;
            }
        });
    }

    if (nameInput) {
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addBtn.click();
            }
        });
    }

    listEl.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const input = e.target.closest('[data-role="remaining"]');
        if (!input) return;
        e.preventDefault();
        const card = input.closest('.ot-card');
        const applyBtn = card && card.querySelector('[data-action="apply"]');
        if (applyBtn) applyBtn.click();
    });

    // ─── 시작 ────────────────────────────────────────────────────────

    async function init() {
        if (!window.originDb) {
            setStatus('originDb가 없습니다. 스크립트 로드 순서를 확인하세요.', true);
            return;
        }
        await reload();
        tickTimer = setInterval(tickCountdowns, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
