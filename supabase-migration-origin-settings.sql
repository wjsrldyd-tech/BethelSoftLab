-- ============================================================
-- 대항해시대 오리진 — 앱 설정 (타이머 보정프트 등)
-- BethelSoftLab / Supabase SQL Editor에서 실행
-- ============================================================
-- data 예:
--   { "driftOverMin": 1200, "barterCapacity": 5000, "barterHave": { "village:exchange": { "재료": 100 } } }
--     driftOverMin — N분당 3초 보정 (기본 1200 → 약 400분마다 -1초)
--     barterCapacity — 함대 총적재량
--     barterHave — 물물교환 재료 적재 현황
--
-- ※ 신규 테이블 직후 PostgREST가 404(PGRST205)를 내는 경우가 있음.
--   → 아래 NOTIFY 로 스키마 캐시를 갱신한다.
--   → 그래도 404면 Dashboard → Settings → API → Reload schema 또는
--     아무 DDL(예: comment) 한 줄 더 실행하면 캐시가 갱신되는 경우가 많다.
-- ============================================================

create table if not exists public.origin_settings (
    tenant_id   text            not null,
    data        jsonb           not null default '{}'::jsonb,
    updated_at  timestamptz     not null default now(),
    primary key (tenant_id)
);

comment on table public.origin_settings is
    '대항오 헬퍼 테넌트 설정(JSON). driftOverMin, barterCapacity, barterHave 등';

comment on column public.origin_settings.data is
    '예: {"driftOverMin":1200,"barterCapacity":5000,"barterHave":{}}';

-- set_updated_at() 은 supabase-migration-support.sql / origin 마이그레이션에서 생성됨
drop trigger if exists trg_origin_settings_updated_at on public.origin_settings;
create trigger trg_origin_settings_updated_at
    before update on public.origin_settings
    for each row execute function public.set_updated_at();

-- Supabase는 신규 테이블에 RLS가 기본 ON인 경우가 많음 → 끄고 anon CRUD 허용
alter table public.origin_settings disable row level security;

do $$
declare
    r record;
begin
    for r in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = 'origin_settings'
    loop
        execute format(
            'drop policy if exists %I on public.origin_settings',
            r.policyname
        );
    end loop;
end $$;

grant select, insert, update, delete
    on public.origin_settings
    to anon, authenticated, service_role;

-- PostgREST 스키마 캐시 강제 갱신 (신규 테이블 404 방지)
notify pgrst, 'reload schema';

-- 캐시가 안 풀릴 때 대비: 메타만 살짝 건드림 (재실행 안전)
comment on table public.origin_settings is
    '대항오 헬퍼 테넌트 설정(JSON). driftOverMin, barterCapacity, barterHave 등';

notify pgrst, 'reload schema';

-- ============================================================
-- 롤백 (필요 시 주석 해제)
-- ============================================================
-- drop table if exists public.origin_settings;
