-- ============================================================
-- 대항해시대 오리진 — 교역소 타이머 DB 마이그레이션
-- BethelSoftLab / Supabase SQL Editor에서 실행
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- 1. origin_trade_posts — 항구별 교역소 기준 시각
-- ============================================================
-- anchor_at : 최초 입장 또는 재화 초기화 시각 (절대 시각)
-- synced_at : 남은 시간/입장/재화 초기화로 주기를 맞춘 시각
-- synced_elapsed_min : 이번 맞춤 직전 맞춤으로부터의 경과(분)
-- interval_min : 재고 리셋 주기 (분) — 기본 30

create table if not exists public.origin_trade_posts (
    id            text            not null,
    tenant_id     text            not null,
    port_name     text            not null default '',
    anchor_at     timestamptz     not null,
    interval_min  int             not null default 30,
    sold_out      boolean         not null default false,
    sold_out_at   timestamptz     null,
    synced_at     timestamptz     null,
    synced_elapsed_min int        null,
    created_at    timestamptz     not null default now(),
    updated_at    timestamptz     not null default now(),
    primary key (tenant_id, id)
);

-- 기존 테이블 배포분 호환
alter table public.origin_trade_posts
    add column if not exists sold_out boolean not null default false;
alter table public.origin_trade_posts
    add column if not exists sold_out_at timestamptz null;
-- synced_at : 남은 시간/입장/재화 초기화로 주기를 맞춘 시각
alter table public.origin_trade_posts
    add column if not exists synced_at timestamptz null;
alter table public.origin_trade_posts
    add column if not exists synced_elapsed_min int null;

create index if not exists idx_origin_trade_posts_tenant_name
    on public.origin_trade_posts(tenant_id, port_name);

create index if not exists idx_origin_trade_posts_tenant_updated
    on public.origin_trade_posts(tenant_id, updated_at desc);

-- ============================================================
-- 2. updated_at 자동 갱신 트리거
-- ============================================================
-- set_updated_at() 함수는 supabase-migration-support.sql 에서 이미 생성됨.
-- 없으면 아래 CREATE FUNCTION 주석 해제 후 실행.
--
-- create or replace function public.set_updated_at()
-- returns trigger language plpgsql as $$
-- begin
--     new.updated_at = now();
--     return new;
-- end;
-- $$;

drop trigger if exists trg_origin_trade_posts_updated_at on public.origin_trade_posts;
create trigger trg_origin_trade_posts_updated_at
    before update on public.origin_trade_posts
    for each row execute function public.set_updated_at();

-- ============================================================
-- 3. 권한 + RLS (D3/주식과 동일 — anon key + tenant_id 필터)
-- ============================================================
-- 새 테이블은 프로젝트 설정에 따라 RLS가 기본 활성일 수 있어 401이 난다.
-- 명시적으로 끄고 anon/authenticated에 CRUD 권한을 부여한다.

alter table public.origin_trade_posts disable row level security;

grant select, insert, update, delete
    on public.origin_trade_posts
    to anon, authenticated, service_role;

-- 추후 Supabase Auth 전환 시:
-- alter table public.origin_trade_posts enable row level security;
-- create policy "origin_trade_posts_own" on public.origin_trade_posts
--     for all using (tenant_id = auth.uid()::text);

-- ============================================================
-- 4. origin_pin_overrides — 해역 맵 항구 핀 좌표 오버라이드
-- ============================================================
-- data : { [viewId]: { [portName]: { x, y } } } JSON
-- 브라우저 localStorage(origin_pin_overrides_v1)와 동일 구조

create table if not exists public.origin_pin_overrides (
    tenant_id   text            not null,
    data        jsonb           not null default '{}'::jsonb,
    updated_at  timestamptz     not null default now(),
    primary key (tenant_id)
);

drop trigger if exists trg_origin_pin_overrides_updated_at on public.origin_pin_overrides;
create trigger trg_origin_pin_overrides_updated_at
    before update on public.origin_pin_overrides
    for each row execute function public.set_updated_at();

alter table public.origin_pin_overrides disable row level security;

grant select, insert, update, delete
    on public.origin_pin_overrides
    to anon, authenticated, service_role;

-- ============================================================
-- 5. origin_good_plain_qty — 항구·교역품별 평시 구매 수량
-- ============================================================
-- 유저는 게임에서 보이는 수량을 입력하고, 클라이언트는 시즌 배수로
-- 나눠 평시(plain_qty)만 저장한다. 표시 시 다시 월별 배수를 곱한다.

create table if not exists public.origin_good_plain_qty (
    tenant_id   text            not null,
    port_name   text            not null,
    good_name   text            not null,
    plain_qty   numeric         not null default 0,
    updated_at  timestamptz     not null default now(),
    primary key (tenant_id, port_name, good_name)
);

create index if not exists idx_origin_good_plain_qty_tenant_port
    on public.origin_good_plain_qty(tenant_id, port_name);

drop trigger if exists trg_origin_good_plain_qty_updated_at on public.origin_good_plain_qty;
create trigger trg_origin_good_plain_qty_updated_at
    before update on public.origin_good_plain_qty
    for each row execute function public.set_updated_at();

alter table public.origin_good_plain_qty disable row level security;

do $$
declare
    r record;
begin
    for r in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = 'origin_good_plain_qty'
    loop
        execute format(
            'drop policy if exists %I on public.origin_good_plain_qty',
            r.policyname
        );
    end loop;
end $$;

grant select, insert, update, delete
    on public.origin_good_plain_qty
    to anon, authenticated, service_role;

-- ============================================================
-- 6. 롤백 (필요 시 주석 해제)
-- ============================================================
-- drop table if exists public.origin_good_plain_qty;
-- drop table if exists public.origin_pin_overrides;
-- drop table if exists public.origin_trade_posts;
