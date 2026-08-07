-- ============================================================
-- 종업원 의뢰 완료 표시 (리셋 없음 — 수동 토글)
-- 선행: supabase-migration-origin.sql (origin_trade_posts)
-- ============================================================

alter table public.origin_trade_posts
    add column if not exists employee_quest_done boolean not null default false;

alter table public.origin_trade_posts
    add column if not exists employee_quest_done_at timestamptz null;

notify pgrst, 'reload schema';
