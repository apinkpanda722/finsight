-- statements: 원본 CSV 저장용 private 버킷. 경로는 {user_id}/{statement_id} 컨벤션만 쓰고
-- 사용자가 업로드한 원본 file_name은 절대 쓰지 않는다 (CLAUDE.md CRITICAL).
-- storage.objects에는 RLS 정책을 하나도 만들지 않는다 — 모든 접근은 service_role의
-- signed URL 발급을 통해서만 이뤄진다 (직접 클라이언트 접근 없음).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('statements', 'statements', false, 5242880, null)
on conflict (id) do nothing;
