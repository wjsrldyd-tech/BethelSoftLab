-- ============================================================
-- 주식 도구 — DB 마이그레이션
-- BethelSoftLab / Supabase SQL Editor에서 실행
-- bethel-class-manager의 supabase-schema.sql, supabase-migration-support.sql 정책 준수
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- 1. stocks_instruments — 종목 마스터
-- ============================================================
-- 주식 메뉴의 모든 도구(PP 계산기, 매매기록, 메모 등)가 공통 참조
-- id        : 'i<timestamp><rand>' 형식, 클라이언트 생성
-- ticker    : 종목코드 (005930, AAPL 등)
-- market    : KOSPI / KOSDAQ / NYSE / NASDAQ 등 (자유 입력)

create table if not exists public.stocks_instruments (
    id          text            not null,
    tenant_id   text            not null,
    ticker      text            not null default '',
    name        text            not null default '',
    market      text                     default '',
    note        text                     default '',
    created_at  timestamptz     not null default now(),
    updated_at  timestamptz     not null default now(),
    primary key (tenant_id, id)
);

-- 종목 목록 조회 (ticker / name 정렬)
create index if not exists idx_stocks_instruments_tenant_ticker
    on public.stocks_instruments(tenant_id, ticker);

create index if not exists idx_stocks_instruments_tenant_name
    on public.stocks_instruments(tenant_id, name);

-- ============================================================
-- 2. stocks_pp_entries — PP 계산기 입력 이력
-- ============================================================
-- instrument_id : nullable — 종목 미선택 상태의 빠른 계산 허용
-- target_date   : 전일 날짜 (사용자가 입력하는 기준일)
-- high/low/close: 입력값 (numeric — 소수점 허용)
-- pp~s5         : 계산 결과 저장 (재계산 불필요)

create table if not exists public.stocks_pp_entries (
    id              text            not null,
    tenant_id       text            not null,
    instrument_id   text,
    target_date     date            not null default current_date,
    high            numeric         not null,
    low             numeric         not null,
    close           numeric         not null,
    pp              numeric,
    r1 numeric, r2 numeric, r3 numeric, r4 numeric, r5 numeric,
    s1 numeric, s2 numeric, s3 numeric, s4 numeric, s5 numeric,
    created_at      timestamptz     not null default now(),
    updated_at      timestamptz     not null default now(),
    primary key (tenant_id, id),
    foreign key (tenant_id, instrument_id)
        references public.stocks_instruments(tenant_id, id)
        on delete set null
);

-- 종목별 최신 이력 조회
create index if not exists idx_stocks_pp_entries_tenant_instrument_date
    on public.stocks_pp_entries(tenant_id, instrument_id, target_date desc);

-- 날짜 기준 전체 이력 조회
create index if not exists idx_stocks_pp_entries_tenant_date
    on public.stocks_pp_entries(tenant_id, target_date desc);

-- ============================================================
-- 3. updated_at 자동 갱신 트리거
-- ============================================================
-- set_updated_at() 함수는 supabase-migration-support.sql 에서 이미 생성됨.
-- 없으면 아래 주석 해제 후 실행.
--
-- create or replace function public.set_updated_at()
-- returns trigger language plpgsql as $$
-- begin
--     new.updated_at = now();
--     return new;
-- end;
-- $$;

drop trigger if exists trg_stocks_instruments_updated_at on public.stocks_instruments;
create trigger trg_stocks_instruments_updated_at
    before update on public.stocks_instruments
    for each row execute function public.set_updated_at();

drop trigger if exists trg_stocks_pp_entries_updated_at on public.stocks_pp_entries;
create trigger trg_stocks_pp_entries_updated_at
    before update on public.stocks_pp_entries
    for each row execute function public.set_updated_at();

-- ============================================================
-- 4. RLS (Row Level Security)
-- ============================================================
-- 현재: anon key + tenant_id 필터로 데이터 격리 (D3와 동일 정책)
-- 추후 Supabase Auth 전환 시 아래 주석 해제
--
-- alter table public.stocks_instruments enable row level security;
-- alter table public.stocks_pp_entries  enable row level security;
--
-- create policy "stocks_instruments_own" on public.stocks_instruments
--     for all using (tenant_id = auth.uid()::text);
-- create policy "stocks_pp_entries_own" on public.stocks_pp_entries
--     for all using (tenant_id = auth.uid()::text);

-- ============================================================
-- 5. 향후 확장 테이블 (필요 시 추가)
-- ============================================================
-- stocks_trades  : (구 stocks_trades 예정 → stocks_journal_* 로 구현됨)
-- stocks_memos   : 종목별 분석 메모 / 노트
-- stocks_alerts  : 관심 종목 알림 설정
--
-- 모두 instrument_id FK로 stocks_instruments를 참조하는 구조

-- ============================================================
-- 6. 롤백 (필요 시 주석 해제)
-- ============================================================
-- drop table if exists public.stocks_pp_entries;
-- drop table if exists public.stocks_instruments;
