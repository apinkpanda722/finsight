# Step 1: supabase-schema

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` (ADR-002, ADR-003, ADR-005, ADR-006, ADR-007 — 이 step의 스키마 설계 근거)
- `/plan.md`의 "DB 스키마" 섹션 (있다면; 삭제됐다면 이 step 파일의 SQL이 최종본이다)
- step 0에서 생성된 `package.json`, `src/lib/env.ts`

## 작업

이 step은 순수 Postgres/Supabase 마이그레이션이다. `src/**/*.ts(x)` 애플리케이션 코드는 건드리지 않는다(TDD guard 대상 아님).

### 1. Supabase 프로젝트 준비

`mcp__supabase__create_project` 등 MCP 툴로 프로젝트 생성을 먼저 시도하라. 실패하거나 툴을 쓸 수 없으면 `phases/mvp/index.json`의 이 step을 `"status": "blocked"`, `"blocked_reason"`에 "Supabase 프로젝트를 수동으로 생성하고 URL/키를 `.env`에 채워달라"고 기록한 뒤 중단하라.

프로젝트가 준비되면 `.env`에 이미 있는 `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` 값이 실제 프로젝트를 가리키는지 확인하라(비어있으면 위와 같이 blocked 처리).

### 2. 마이그레이션 SQL 적용

아래 SQL을 순서대로(하나의 마이그레이션 파일 또는 여러 파일로) 적용한다. `mcp__supabase__apply_migration` 또는 동등한 MCP 툴을 사용하라.

```sql
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
```

### 3. Storage 버킷

`statements` 버킷을 private, `file_size_limit = 5242880`(5MB)으로 생성한다(SQL 예시: `insert into storage.buckets (id, name, public, file_size_limit) values ('statements', 'statements', false, 5242880);` 또는 동등한 MCP 툴 호출). **`storage.objects`에 대해 어떤 `authenticated` RLS 정책도 만들지 마라** — 모든 접근은 이후 step에서 service_role 서버 코드와 signed URL로만 이뤄진다.

### 4. Auth 설정

Supabase 대시보드/API로 다음을 확인·설정한다:
- **Confirm email: ON** (기본값 유지 — 끄지 마라)
- Site URL과 Redirect URL에 로컬 개발 주소(`http://localhost:3000/**`)를 등록한다. 프로덕션 도메인은 아직 없으면 생략하고 step 9에서 추가한다.

### 5. 타입 생성

```bash
npx supabase gen types typescript --project-id <project-ref> > src/types/supabase.ts
```
(MCP 툴로 프로젝트를 만들었다면 project-ref를 그 결과에서 가져온다.)

## Acceptance Criteria

```bash
npm run lint
npm run build
npm test
```
(이 step은 SQL 마이그레이션이 핵심이라 `npm test`에 새 테스트가 추가되지 않을 수 있다 — 기존 테스트가 깨지지 않는지만 확인하면 된다. `npm run build`는 `types/supabase.ts`가 유효한 TypeScript인지 검증한다.)

## 검증 절차

1. 위 AC를 실행한다.
2. `mcp__supabase__get_advisors`(또는 동등 MCP 툴)로 RLS 누락·보안 경고를 확인하고, 새로 발견된 경고가 없는지 확인한다.
3. 모든 테이블에 RLS가 켜져 있는지, `profiles`/`accounts`/`uploaded_statements`/`transactions`에 INSERT/UPDATE/DELETE 정책이 하나도 없는지(즉 서버 service role 경로로만 쓰기가 가능한지) 확인한다.
4. `upload_usage`에 `authenticated` 정책이 하나도 없는지 확인한다.
5. `create_statement_upload`/`finalize_statement`가 `service_role`에만 execute 권한이 있고 `has_locked_history()`는 `authenticated`에만 있는지 SQL로 확인한다.
6. 결과에 따라 `phases/mvp/index.json`의 step 1 항목을 업데이트한다.

## 금지사항

- `profiles.plan`, `subscription_status` 등 구독 필드를 사용자가 직접 update할 수 있는 RLS 정책을 만들지 마라 — 이유: webhook 서버 코드만 이 필드를 갱신해야 한다(CLAUDE.md CRITICAL).
- `accounts`/`uploaded_statements`/`transactions`에 INSERT/UPDATE/DELETE RLS 정책을 열지 마라 — 이유: 모든 쓰기는 `create_statement_upload`/`finalize_statement` RPC 또는 service_role 코드를 통해서만 이뤄져야 한다.
- `storage.objects`에 `authenticated` 역할용 정책을 만들지 마라 — 이유: signed URL과 service_role만으로 접근을 제한하는 설계다.
- `create_statement_upload`/`finalize_statement`에 `authenticated`나 `anon` execute 권한을 주지 마라 — 이유: 클라이언트가 직접 호출하면 서버의 소유권/세션 검증을 우회할 수 있다.
- Confirm email을 끄지 마라 — 이유: 금융 데이터와 결제 계정을 다루므로 검증된 이메일이 필요하다는 결정이 이미 내려졌다.
- 이 step에서 `src/app`, `src/services`, `src/lib/{supabase,polar,anthropic}` 등 애플리케이션 코드를 작성하지 마라 — 이유: 이후 step의 범위다.
- 기존 테스트를 깨뜨리지 마라.
