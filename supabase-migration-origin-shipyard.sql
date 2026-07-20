-- ============================================================
-- 조선소 구매 표시 (현실 KST 월요일 00:00 주간 리셋)
-- 선행: supabase-migration-origin.sql (origin_trade_posts)
-- ============================================================

alter table public.origin_trade_posts
    add column if not exists shipyard_bought boolean not null default false;

alter table public.origin_trade_posts
    add column if not exists shipyard_bought_at timestamptz null;

notify pgrst, 'reload schema';
