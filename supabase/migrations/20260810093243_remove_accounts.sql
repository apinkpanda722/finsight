-- accounts 엔티티를 제거하고, 명세서에 파싱된 표시용 라벨만 보존한다.
drop function public.create_statement_upload(uuid, uuid, text, text, integer);
drop function public.finalize_statement(uuid, uuid, jsonb);

alter table public.uploaded_statements
  drop column account_id;

drop policy "select own accounts" on public.accounts;
drop table public.accounts;

alter table public.uploaded_statements
  add column detected_label text;

-- 원자적 업로드 횟수 검사 + statement 생성을 계좌 입력 없이 수행한다.
create or replace function public.create_statement_upload(
  p_user_id uuid,
  p_file_name text,
  p_declared_size integer
)
returns table (statement_id uuid, storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_statement_id uuid;
  v_storage_path text;
  v_plan text;
  v_usage_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select plan into v_plan from public.profiles where id = p_user_id;
  if v_plan is null then
    raise exception 'profile_not_found';
  end if;

  select count(*) into v_usage_count
    from public.upload_usage
    where user_id = p_user_id and created_at > now() - interval '24 hours';
  if v_usage_count >= 10 then
    raise exception 'rate_limited';
  end if;

  v_statement_id := gen_random_uuid();
  v_storage_path := p_user_id::text || '/' || v_statement_id::text;

  insert into public.uploaded_statements
    (id, user_id, file_name, declared_file_size_bytes, storage_path, status)
    values (v_statement_id, p_user_id, p_file_name, p_declared_size, v_storage_path, 'uploading');

  insert into public.upload_usage (user_id, statement_id) values (p_user_id, v_statement_id);

  return query select v_statement_id, v_storage_path;
end;
$$;

revoke all on function public.create_statement_upload(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.create_statement_upload(uuid, text, integer) to service_role;

-- 거래 교체 + statement 완료 전환을 단일 트랜잭션으로 수행하고 표시용 라벨을 보존한다.
create or replace function public.finalize_statement(
  p_user_id uuid,
  p_statement_id uuid,
  p_transactions jsonb,
  p_detected_label text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row_count integer;
  v_period_start date;
  v_period_end date;
  v_is_processing boolean;
begin
  select (status = 'processing'), row_count
    into v_is_processing, v_row_count
    from public.uploaded_statements
    where id = p_statement_id and user_id = p_user_id;

  if v_is_processing is not true then
    return false; -- 삭제됐거나 이미 lease가 없는 statement: no-op
  end if;

  if (select count(distinct (t->>'row_index')::int) from jsonb_array_elements(p_transactions) t) <> v_row_count
     or (select min((t->>'row_index')::int) from jsonb_array_elements(p_transactions) t) <> 0
     or (select max((t->>'row_index')::int) from jsonb_array_elements(p_transactions) t) <> v_row_count - 1
  then
    raise exception 'reconciliation_failed';
  end if;

  delete from public.transactions where statement_id = p_statement_id;

  insert into public.transactions
    (user_id, statement_id, row_index, transaction_date, description, amount, category)
  select
    p_user_id, p_statement_id,
    (t->>'row_index')::int,
    (t->>'transaction_date')::date,
    t->>'description',
    (t->>'amount')::numeric(14,2),
    t->>'category'
  from jsonb_array_elements(p_transactions) t;
  -- 테이블 CHECK 제약(amount<>0, category=income이면 amount>0, row_index unique 등)이
  -- 여기서 위반되면 예외가 나서 함수 전체가 자동 rollback된다 — 별도 검증 코드 불필요.

  select min(transaction_date), max(transaction_date)
    into v_period_start, v_period_end
    from public.transactions where statement_id = p_statement_id;

  update public.uploaded_statements
    set status = 'completed',
        parsed_transaction_count = v_row_count,
        period_start = v_period_start,
        period_end = v_period_end,
        detected_label = coalesce(p_detected_label, detected_label),
        processed_at = now(),
        updated_at = now()
    where id = p_statement_id;

  return true;
end;
$$;

revoke all on function public.finalize_statement(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.finalize_statement(uuid, uuid, jsonb, text) to service_role;
