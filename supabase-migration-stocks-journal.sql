-- ============================================================
-- 매매 일지 — DB 마이그레이션
-- BethelSoftLab / Supabase SQL Editor에서 실행
-- 선행: supabase-migration-stocks.sql (stocks_instruments)
-- ============================================================

-- ============================================================
-- 1. stocks_journal_bases — 종목별 일지 시작점 (현재 보유 상태)
-- ============================================================
-- instrument_id : 종목당 1건 (unique)
-- base_qty      : 현재 보유수량
-- base_avg      : 현재 평단가
-- 평단·수량 스냅샷은 저장하지 않음 — entries 로드 후 클라이언트 재계산

create table if not exists public.stocks_journal_bases (
    id              text            not null,
    tenant_id       text            not null,
    instrument_id   text            not null,
    base_qty        numeric         not null,
    base_avg        numeric         not null,
    note            text                     default '',
    created_at      timestamptz     not null default now(),
    updated_at      timestamptz     not null default now(),
    primary key (tenant_id, id),
    unique (tenant_id, instrument_id),
    foreign key (tenant_id, instrument_id)
        references public.stocks_instruments(tenant_id, id)
        on delete cascade
);

create index if not exists idx_stocks_journal_bases_tenant_instrument
    on public.stocks_journal_bases(tenant_id, instrument_id);

-- ============================================================
-- 2. stocks_journal_entries — 매매 기록 (일지 본문)
-- ============================================================
-- side       : 'buy' | 'sell'
-- sort_order : 표시 순서 (추가 시 증가)

create table if not exists public.stocks_journal_entries (
    id              text            not null,
    tenant_id       text            not null,
    instrument_id   text            not null,
    side            text            not null check (side in ('buy', 'sell')),
    price           numeric         not null,
    qty             numeric         not null,
    traded_at       date            not null default current_date,
    note            text                     default '',
    sort_order      int             not null default 0,
    created_at      timestamptz     not null default now(),
    updated_at      timestamptz     not null default now(),
    primary key (tenant_id, id),
    foreign key (tenant_id, instrument_id)
        references public.stocks_instruments(tenant_id, id)
        on delete cascade
);

create index if not exists idx_stocks_journal_entries_tenant_instrument_order
    on public.stocks_journal_entries(tenant_id, instrument_id, sort_order);

-- ============================================================
-- 3. updated_at 트리거
-- ============================================================
drop trigger if exists trg_stocks_journal_bases_updated_at on public.stocks_journal_bases;
create trigger trg_stocks_journal_bases_updated_at
    before update on public.stocks_journal_bases
    for each row execute function public.set_updated_at();

drop trigger if exists trg_stocks_journal_entries_updated_at on public.stocks_journal_entries;
create trigger trg_stocks_journal_entries_updated_at
    before update on public.stocks_journal_entries
    for each row execute function public.set_updated_at();

-- ============================================================
-- 4. 롤백 (필요 시 주석 해제)
-- ============================================================
-- drop table if exists public.stocks_journal_entries;
-- drop table if exists public.stocks_journal_bases;
