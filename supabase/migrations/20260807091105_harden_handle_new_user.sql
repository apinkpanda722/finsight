-- handle_new_user()는 auth.users insert 트리거 전용 함수다. security definer + public 스키마라
-- PostgREST가 기본적으로 /rest/v1/rpc/handle_new_user로 자동 노출시키므로(advisor WARN),
-- 트리거 실행에는 영향 없이 직접 RPC 호출만 차단한다.
revoke all on function public.handle_new_user() from public, anon, authenticated;
