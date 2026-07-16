-- ============================================================
-- 대항해시대 오리진 — 교역품 평시 구매 수량
-- BethelSoftLab / Supabase SQL Editor에서 실행
-- (origin_trade_posts / set_updated_at 이미 있는 환경용 단독 스크립트)
-- ============================================================

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

-- Supabase는 신규 테이블에 RLS가 기본 ON인 경우가 많음.
-- origin_trade_posts / origin_pin_overrides와 동일하게 끄고 anon CRUD 허용.
alter table public.origin_good_plain_qty disable row level security;

-- 혹시 붙은 정책이 있으면 제거 (disable만으로는 부족할 때 대비)
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
