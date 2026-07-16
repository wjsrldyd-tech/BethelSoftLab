-- ============================================================
-- 도구점 구매 표시 (현실 KST 자정 리셋)
-- 선행: supabase-migration-origin.sql (origin_trade_posts)
-- ============================================================

alter table public.origin_trade_posts
    add column if not exists tool_shop_bought boolean not null default false;

alter table public.origin_trade_posts
    add column if not exists tool_shop_bought_at timestamptz null;
