-- ============================================================
-- profiles: auth.users 1:1. 앱 권한 + Polar 구독 snapshot.
-- plan/subscription_*은 webhook(service_role)만 갱신한다 (CLAUDE.md CRITICAL).
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  plan text not null default 'free' check (plan in ('free','pro')),
  polar_customer_id text unique,
  polar_subscription_id text unique,
  polar_product_id text,
  subscription_status text check (subscription_status in
    ('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  polar_modified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "select own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

-- auth.users insert 시 profiles 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- accounts: 사용자가 붙이는 계좌/카드 라벨. Free 1개 제한은 row 수로 카운트.
-- ============================================================
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  unique (user_id, label),
  unique (user_id, id)
);

alter table public.accounts enable row level security;

create policy "select own accounts" on public.accounts
  for select to authenticated using ((select auth.uid()) = user_id);

-- ============================================================
-- uploaded_statements
-- ============================================================
create table public.uploaded_statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  file_name text not null check (char_length(file_name) between 1 and 255),
  declared_file_size_bytes integer not null check (declared_file_size_bytes between 1 and 5242880),
  file_size_bytes integer check (file_size_bytes between 1 and 5242880),
  row_count integer check (row_count between 1 and 2000),
  parsed_transaction_count integer check (parsed_transaction_count >= 0),
  period_start date,
  period_end date,
  storage_path text not null unique,
  status text not null default 'uploading' check
    (status in ('uploading','pending','processing','completed','failed')),
  failure_code text check (failure_code in
    ('upload_missing','file_too_large','invalid_csv','encoding_error','mapping_failed',
     'classification_failed','refusal','max_tokens','reconciliation_failed','provider_unavailable','unknown')),
  error_message text,
  parse_attempt_count integer not null default 0 check (parse_attempt_count >= 0),
  processing_lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  foreign key (user_id, account_id) references public.accounts(user_id, id) on delete cascade,
  unique (user_id, id),
  check (period_start is null or period_end is null or period_start <= period_end),
  check (status in ('uploading','failed') or (file_size_bytes is not null and row_count is not null))
);

alter table public.uploaded_statements enable row level security;

create policy "select own statements" on public.uploaded_statements
  for select to authenticated using ((select auth.uid()) = user_id);

-- ============================================================
-- upload_usage: 삭제 불가능한 append-only 비용 집계 (레이트리미팅 근거)
-- ============================================================
create table public.upload_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  statement_id uuid references public.uploaded_statements(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_upload_usage_user_created on public.upload_usage (user_id, created_at desc);

alter table public.upload_usage enable row level security;
-- authenticated 정책을 의도적으로 하나도 만들지 않는다 (RPC로만 기록/조회).

-- ============================================================
-- transactions
-- ============================================================
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  statement_id uuid not null,
  row_index integer not null check (row_index >= 0),
  transaction_date date not null,
  description text not null check (char_length(description) <= 500),
  amount numeric(14,2) not null check (amount <> 0),
  category text not null check (category in (
    'food_dining','groceries','transport','shopping','entertainment','utilities',
    'housing','healthcare','education','travel','subscriptions','income','transfer','fees','other'
  )),
  is_duplicate_flag boolean not null default false,
  is_anomaly_flag boolean not null default false,
  created_at timestamptz not null default now(),
  check (category <> 'income' or amount > 0),
  foreign key (user_id, statement_id)
    references public.uploaded_statements(user_id, id) on delete cascade,
  unique (statement_id, row_index)
);
create index idx_transactions_user_date on public.transactions (user_id, transaction_date desc);

alter table public.transactions enable row level security;

-- 소유권 + Free 히스토리(현재 달 포함 최근 3개 달) 제한을 함께 강제
create policy "select own transactions" on public.transactions
  for select to authenticated using (
    (select auth.uid()) = user_id
    and (
      transaction_date >= (
        date_trunc('month', now() at time zone 'Asia/Seoul') - interval '2 months'
      )::date
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.plan = 'pro'
      )
    )
  );

-- ============================================================
-- has_locked_history(): Free 사용자의 잠긴 과거 데이터 "존재 여부"만 반환 (실제 값 노출 없음)
-- ============================================================
create or replace function public.has_locked_history()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(
      (
        select p.plan = 'free'
        from public.profiles p
        where p.id = (select auth.uid())
      ),
      false
    )
    and exists (
      select 1
      from public.uploaded_statements s
      where s.user_id = (select auth.uid())
        and s.status = 'completed'
        and s.period_start < (
          date_trunc('month', now() at time zone 'Asia/Seoul') - interval '2 months'
        )::date
    );
$$;

revoke all on function public.has_locked_history() from public, anon;
grant execute on function public.has_locked_history() to authenticated;

-- ============================================================
-- create_statement_upload: 원자적 quota 검사 + account 선택/생성 + statement 생성
-- ============================================================
create or replace function public.create_statement_upload(
  p_user_id uuid,
  p_account_id uuid,
  p_new_account_label text,
  p_file_name text,
  p_declared_size integer
)
returns table (statement_id uuid, storage_path text, account_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_statement_id uuid;
  v_storage_path text;
  v_plan text;
  v_account_count integer;
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

  if p_account_id is not null then
    select id into v_account_id
      from public.accounts
      where id = p_account_id and user_id = p_user_id;
    if v_account_id is null then
      raise exception 'account_not_found';
    end if;
  else
    select count(*) into v_account_count from public.accounts where user_id = p_user_id;
    if v_plan = 'free' and v_account_count >= 1 then
      raise exception 'upgrade_required';
    end if;
    insert into public.accounts (user_id, label)
      values (p_user_id, p_new_account_label)
      returning id into v_account_id;
  end if;

  v_statement_id := gen_random_uuid();
  v_storage_path := p_user_id::text || '/' || v_statement_id::text;

  insert into public.uploaded_statements
    (id, user_id, account_id, file_name, declared_file_size_bytes, storage_path, status)
    values (v_statement_id, p_user_id, v_account_id, p_file_name, p_declared_size, v_storage_path, 'uploading');

  insert into public.upload_usage (user_id, statement_id) values (p_user_id, v_statement_id);

  return query select v_statement_id, v_storage_path, v_account_id;
end;
$$;

revoke all on function public.create_statement_upload(uuid, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.create_statement_upload(uuid, uuid, text, text, integer) to service_role;

-- ============================================================
-- finalize_statement: 거래 교체 + statement 완료 전환을 단일 트랜잭션으로
-- ============================================================
create or replace function public.finalize_statement(
  p_user_id uuid,
  p_statement_id uuid,
  p_transactions jsonb
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
        processed_at = now(),
        updated_at = now()
    where id = p_statement_id;

  return true;
end;
$$;

revoke all on function public.finalize_statement(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_statement(uuid, uuid, jsonb) to service_role;
