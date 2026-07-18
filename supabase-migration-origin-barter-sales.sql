-- ============================================================
-- 대항해시대 오리진 — 물물교환 품목 판매 기록
-- BethelSoftLab / Supabase SQL Editor에서 실행
-- ============================================================
-- 단가(unit_price) = 판매가 ÷ (시세% ÷ 100) → 소수점 반올림
-- 예: 시세 104, 판매가 859 → 단가 826
--
-- ※ 신규 테이블 직후 PostgREST 404(PGRST205)가 날 수 있음 → NOTIFY로 캐시 갱신
-- ============================================================

create table if not exists public.origin_barter_sales (
    tenant_id    text            not null,
    id           text            not null,
    good_name    text            not null,
    port_name    text            not null,
    market_pct   numeric         not null,
    sale_price   numeric         not null,
    unit_price   numeric         not null,
    sold_at      timestamptz     not null default now(),
    updated_at   timestamptz     not null default now(),
    primary key (tenant_id, id)
);

comment on table public.origin_barter_sales is
    '물물교환 품목 판매 기록. unit_price = sale_price / (market_pct/100)';

comment on column public.origin_barter_sales.market_pct is
    '시세 퍼센트 (예: 104)';

comment on column public.origin_barter_sales.sale_price is
    '실제 판매가 (시세 반영 가격)';

comment on column public.origin_barter_sales.unit_price is
    '100% 환산 단가';

create index if not exists idx_origin_barter_sales_tenant_sold
    on public.origin_barter_sales(tenant_id, sold_at desc);

create index if not exists idx_origin_barter_sales_tenant_good_sold
    on public.origin_barter_sales(tenant_id, good_name, sold_at desc);

create index if not exists idx_origin_barter_sales_tenant_port_sold
    on public.origin_barter_sales(tenant_id, port_name, sold_at desc);

-- set_updated_at() 은 origin 마이그레이션에서 생성됨
drop trigger if exists trg_origin_barter_sales_updated_at on public.origin_barter_sales;
create trigger trg_origin_barter_sales_updated_at
    before update on public.origin_barter_sales
    for each row execute function public.set_updated_at();

alter table public.origin_barter_sales disable row level security;

do $$
declare
    r record;
begin
    for r in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = 'origin_barter_sales'
    loop
        execute format(
            'drop policy if exists %I on public.origin_barter_sales',
            r.policyname
        );
    end loop;
end $$;

grant select, insert, update, delete
    on public.origin_barter_sales
    to anon, authenticated, service_role;

notify pgrst, 'reload schema';

comment on table public.origin_barter_sales is
    '물물교환 품목 판매 기록. unit_price = sale_price / (market_pct/100)';

notify pgrst, 'reload schema';

-- ============================================================
-- 롤백 (필요 시 주석 해제)
-- ============================================================
-- drop table if exists public.origin_barter_sales;
