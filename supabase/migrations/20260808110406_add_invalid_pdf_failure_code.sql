-- PDF 명세서 지원 추가: 표 구조를 읽을 수 없는 PDF에 대한 검증 실패 코드.
alter table public.uploaded_statements
  drop constraint if exists uploaded_statements_failure_code_check;

alter table public.uploaded_statements
  add constraint uploaded_statements_failure_code_check check (failure_code in
    ('upload_missing','file_too_large','invalid_csv','encoding_error','invalid_pdf','mapping_failed',
     'classification_failed','refusal','max_tokens','reconciliation_failed','provider_unavailable','unknown'));
