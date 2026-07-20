-- ============================================================
-- 대항해시대 오리진 — 항구명 중복 정리 + 유니크 제약
-- BethelSoftLab / Supabase SQL Editor에서 실행
-- ============================================================
-- 배경: origin_trade_posts는 (tenant_id, id) PK만 있어 port_name이
-- 중복될 수 있었음. 앱은 조회 시 port_name으로만 찾아 첫 항목만 쓰므로
-- 중복이 생기면 타이머/매진/도구점 표시가 뒤섞일 수 있었음.
-- 이제부터는 앱(js/origin-db.js)도 이름으로 기존 행을 찾아 재사용하도록
-- 고쳐졌으나, 과거에 이미 생성된 중복이 있을 수 있어 정리 + 재발 방지
-- 제약을 함께 건다.

-- ============================================================
-- 1. 기존 중복 정리: 같은 tenant_id + port_name 중 최신(updated_at)만 남김
-- ============================================================
-- 1-1) updated_at이 더 최신인 행이 있으면 오래된 쪽 삭제
delete from public.origin_trade_posts a
using public.origin_trade_posts b
where a.tenant_id = b.tenant_id
  and a.port_name = b.port_name
  and a.port_name <> ''
  and a.updated_at < b.updated_at;

-- 1-2) updated_at까지 같으면 id가 더 작은 쪽(먼저 생성된 쪽) 삭제
delete from public.origin_trade_posts a
using public.origin_trade_posts b
where a.tenant_id = b.tenant_id
  and a.port_name = b.port_name
  and a.port_name <> ''
  and a.updated_at = b.updated_at
  and a.id < b.id;

-- ============================================================
-- 2. 재발 방지: (tenant_id, port_name) 유니크 인덱스
-- ============================================================
-- port_name = '' (미등록 상태)는 여러 개 있을 수 있으므로 제외.
create unique index if not exists uq_origin_trade_posts_tenant_port
    on public.origin_trade_posts(tenant_id, port_name)
    where port_name <> '';
