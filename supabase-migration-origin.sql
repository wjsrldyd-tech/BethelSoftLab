-- ============================================================
-- 대항해시대 오리진 — 교역소 타이머 DB 마이그레이션
-- BethelSoftLab / Supabase SQL Editor에서 실행
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- 1. origin_trade_posts — 항구별 교역소 기준 시각
-- ============================================================
-- anchor_at : 최초 입장 또는 재화 초기화 시각 (절대 시각)
-- interval_min : 재고 리셋 주기 (분) — 기본 30

create table if not exists public.origin_trade_posts (
    id            text            not null,
    tenant_id     text            not null,
    port_name     text            not null default '',
    anchor_at     timestamptz     not null,
    interval_min  int             not null default 30,
    created_at    timestamptz     not null default now(),
    updated_at    timestamptz     not null default now(),
    primary key (tenant_id, id)
);

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
-- 5. 롤백 (필요 시 주석 해제)
-- ============================================================
-- drop table if exists public.origin_pin_overrides;
-- drop table if exists public.origin_trade_posts;
