-- ============================================================
-- D3 스크립트 에디터 — DB 마이그레이션
-- BethelSoftLab / Supabase SQL Editor에서 실행
-- bethel-class-manager의 supabase-schema.sql, supabase-migration-support.sql 정책 준수
-- ============================================================

-- pgcrypto (gen_random_uuid 사용 대비, 기존 프로젝트에 이미 있을 수 있음)
create extension if not exists pgcrypto;

-- ============================================================
-- 1. d3_scripts — 스크립트 메타 테이블 (목록 조회용)
-- ============================================================
-- tenant_id : app_storage.tenant_id 와 동일 text 타입 (BETHEL_TENANT_ID)
-- id        : 클라이언트에서 생성한 고유 ID (s<timestamp><rand>)
-- action_count : Actions 목록 렌더 시 별도 쿼리 없이 수 표시

create table if not exists public.d3_scripts (
    id              text            not null,
    tenant_id       text            not null,
    class_en        text            not null default '',
    class_ko        text            not null default '',
    title           text            not null default '',
    tags            text                     default '',
    distance        int                      default 150,
    min_life        int                      default 101,
    keep_exploring  boolean                  default true,
    action_count    int                      default 0,
    created_at      timestamptz     not null default now(),
    updated_at      timestamptz     not null default now(),
    primary key (tenant_id, id)
);

-- 직업별 최신 목록 조회 (메인 쿼리)
create index if not exists idx_d3_scripts_tenant_class_updated
    on public.d3_scripts(tenant_id, class_en, updated_at desc);

-- 제목 검색 (나중에 ilike 쿼리 대비)
create index if not exists idx_d3_scripts_tenant_title
    on public.d3_scripts(tenant_id, title);

-- ============================================================
-- 2. d3_actions — 스크립트당 Action 목록 (편집 시 로드)
-- ============================================================
-- script_id  : d3_scripts.id 참조 (스크립트 삭제 시 cascade)
-- sort_order : 사용자 지정 순서
-- skill_*    : [Crusader]Provoke 형태로 표시에 사용
-- usage      : ["Buff", "Elite"] 등 체크박스 값 배열
-- general/resource/conditional/buff/attack/density : 섹션별 설정 jsonb

create table if not exists public.d3_actions (
    id              text            not null,
    script_id       text            not null,
    tenant_id       text            not null,
    sort_order      int             not null default 0,
    title           text                     default '',
    skill_en        text            not null default '',
    skill_ko        text                     default '',
    usage           jsonb                    default '[]',
    general         jsonb                    default '{}',
    resource        jsonb                    default '{}',
    conditional     jsonb                    default '{}',
    buff            jsonb                    default '{}',
    attack          jsonb                    default '{}',
    density         jsonb                    default '{}',
    created_at      timestamptz     not null default now(),
    updated_at      timestamptz     not null default now(),
    primary key (tenant_id, id),
    foreign key (tenant_id, script_id)
        references public.d3_scripts(tenant_id, id)
        on delete cascade
);

-- 스크립트 편집 시 Action 순서 조회 (핵심 쿼리)
create index if not exists idx_d3_actions_script_order
    on public.d3_actions(tenant_id, script_id, sort_order);

-- ============================================================
-- 3. updated_at 자동 갱신 트리거
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

drop trigger if exists trg_d3_scripts_updated_at on public.d3_scripts;
create trigger trg_d3_scripts_updated_at
    before update on public.d3_scripts
    for each row execute function public.set_updated_at();

drop trigger if exists trg_d3_actions_updated_at on public.d3_actions;
create trigger trg_d3_actions_updated_at
    before update on public.d3_actions
    for each row execute function public.set_updated_at();

-- ============================================================
-- 4. RLS (Row Level Security)
-- ============================================================
-- bethel-class-manager 정책과 동일 — 초기 단계에서는 비활성.
-- 현재 anon key + tenant_id 필터로 데이터 격리.
-- 추후 Supabase Auth 전환 시 아래 주석 해제.
--
-- alter table public.d3_scripts enable row level security;
-- alter table public.d3_actions  enable row level security;
--
-- create policy "d3_scripts_own" on public.d3_scripts
--     for all using (tenant_id = auth.uid()::text);
-- create policy "d3_actions_own" on public.d3_actions
--     for all using (tenant_id = auth.uid()::text);

-- ============================================================
-- 5. 롤백 (필요 시 주석 해제)
-- ============================================================
-- drop table if exists public.d3_actions;
-- drop table if exists public.d3_scripts;
