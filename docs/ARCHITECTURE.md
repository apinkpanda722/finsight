# 아키텍처

## 디렉토리 구조
```
src/
├── middleware.ts                 # 세션 갱신 + (dashboard) 라우트 보호 (Edge 런타임, Next.js 15 고정)
├── app/
│   ├── (marketing)/
│   │   └── page.tsx              # "/" 랜딩 페이지
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   └── auth/callback/route.ts    # signup 확인 / recovery 분기 / Google OAuth code 교환
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx        # 계좌별 카테고리 지출 요약 + 월별 추이
│   │   ├── uploads/page.tsx          # CSV 업로드 UI, statement 목록/삭제/재시도
│   │   ├── billing/success/page.tsx  # 체크아웃 후 webhook 반영 폴링
│   │   └── settings/billing/page.tsx
│   └── api/
│       ├── checkout/route.ts         # 인증된 same-origin POST, Pro product 고정
│       ├── portal/route.ts           # 인증된 same-origin POST, 본인 customer만
│       ├── webhooks/polar/route.ts
│       └── statements/
│           ├── init-upload/route.ts          # quota 예약 RPC + signed upload URL
│           └── [id]/
│               ├── route.ts                  # GET status / DELETE
│               ├── upload-url/route.ts       # uploading 상태 token 재발급
│               ├── complete-upload/route.ts  # Storage 원본 검증 + 처리 예약
│               └── retry/route.ts            # 만료된 processing lease 재획득
├── components/
│   ├── ui/                        # shadcn/ui 프리미티브 (TDD guard 예외)
│   ├── landing/
│   ├── dashboard/
│   └── auth/
├── lib/
│   ├── supabase/{client,server}.ts   # tdd-guard 예외 (SDK 인스턴스화만)
│   ├── polar/client.ts               # tdd-guard 예외
│   ├── anthropic/client.ts           # tdd-guard 예외
│   ├── csv/decode.ts                 # EUC-KR/CP949 인코딩 감지·변환 (테스트 대상)
│   ├── api/response.ts               # apiError() 공통 에러 응답 헬퍼
│   └── env.ts                        # zod 기반 환경변수 검증
├── services/
│   ├── subscriptionService.ts        # Polar webhook 이벤트 → profiles 갱신
│   ├── statementUploadService.ts     # init/complete/upload-url/retry 로직
│   └── statementParserService.ts     # 결정론적 CSV 파싱 + Claude 컬럼 매핑/카테고리
└── types/
    ├── supabase.ts                    # `supabase gen types typescript` 생성물
    └── domain.ts                      # ApiErrorCode, Plan, TRANSACTION_CATEGORIES 등
```

## 패턴
- Server Components 기본, 인터랙션(업로드, 폴링, 폼)이 필요한 곳만 Client Component
- 서비스 함수는 외부 클라이언트를 의존성으로 주입받는다 — route handler는 얇게, 실제 로직은 서비스 레이어
- 사용자 소유 리소스를 참조하는 테이블 간에는 `(user_id, id)` unique + composite FK를 사용해 cross-user 연결을 DB가 거부한다
- 비용/quota처럼 원자성이 필요한 쓰기는 반드시 `security definer` RPC(`create_statement_upload`, `finalize_statement`)로 트랜잭션 안에서 처리한다. route handler가 직접 다중 테이블에 쓰지 않는다
- Free 사용자에게 "존재하지만 볼 수 없는" 데이터를 알려줘야 할 때는 실제 데이터를 노출하지 않고 boolean만 반환하는 `security definer` RPC(`has_locked_history()`)를 쓴다

## 데이터 흐름

**CSV 업로드 → 분석** (Vercel Function의 4.5MB 요청 본문 한도를 우회하기 위해 파일은 Function을 거치지 않는다):
```
1. 클라이언트: 확장자/5MB 사전 검증 → POST /api/statements/init-upload (메타데이터만)
2. 서버: create_statement_upload RPC (advisory lock 하 일 10회/Free 1계좌 검사 + usage 기록 +
   statement(uploading) 생성을 한 트랜잭션으로) → signed upload URL 발급
3. 클라이언트: CSV 원본을 Supabase Storage에 직접 업로드 (서버를 거치지 않음)
4. 클라이언트: POST /api/statements/{id}/complete-upload
5. 서버: Storage 원본 다운로드 → 실제 크기·인코딩(UTF-8/CP949)·RFC 4180 구조·행 수(≤2,000) 검증
   → 통과 시 status=pending, row_count 저장, 202 응답, after()로 백그라운드 처리 예약
6. 백그라운드: processing lease CAS 획득 → 결정론적으로 CSV 전체를 행 단위 파싱
   → Claude로 헤더+샘플(≤20행) 기반 ColumnMappingSchema 추론 (1회)
   → 결정론적 코드로 날짜/금액/부호 변환
   → Claude로 100행 단위 카테고리 분류(batch마다 독립적으로 재시도 가능한 소규모 호출)
   → 매 batch rowIndex 완전성 검증, 전체 건수/debit-credit 합계 reconciliation
7. finalize_statement RPC: 기존 거래 삭제 + 신규 거래 bulk insert + statement completed 전환을
   한 트랜잭션에서 원자적으로 수행 (statement가 이미 삭제됐으면 no-op)
8. 클라이언트: 2초 간격 최대 150회 폴링으로 상태 확인 → 계좌별 대시보드 갱신
```
실패 시: transient(429/5xx/네트워크)는 지수 backoff로 최대 3회 자동 재시도, permanent(refusal/스키마·reconciliation 실패)는 즉시 `failed`. `after()` worker가 `maxDuration=300` 안에 죽으면 5분 lease가 만료되고, 사용자는 `POST /api/statements/{id}/retry`로 같은 statement를 재개할 수 있다(CAS 기반, `row_index` unique 제약으로 중복 거래 없음).

**결제 (구독 업그레이드)**:
```
"업그레이드" 클릭
→ POST /api/checkout (인증된 same-origin) — 서버가 세션 사용자 + POLAR_PRO_PRODUCT_ID 고정
→ Polar 호스팅 체크아웃 (303 리다이렉트)
→ (비동기) Polar webhook → 서명 검증 → Pro product·external_id 검증
→ modified_at이 profiles.polar_modified_at보다 새로울 때만 profiles 단일 UPDATE
   (stale/역순 webhook은 2xx로 무시해 최신 권한을 되돌리지 않음)
→ 클라이언트는 /billing/success에서 profiles.plan 폴링으로 반영 확인 → Pro 대시보드 전환
```

## 상태 관리
- 서버 상태는 Server Components + Supabase 쿼리로 직접 조회 (RLS가 소유권 + Free 히스토리 제한을 함께 강제)
- 클라이언트 상태(업로드 진행률, 상태 폴링)는 useState/커스텀 훅
- 인증 상태는 middleware + Supabase 세션 쿠키로 관리, 별도 클라이언트 전역 상태 저장소 없음
- 요금제(Free/Pro) 상태는 `profiles.plan`이 유일한 소스. Free 사용자의 잠긴 과거 데이터 존재 여부는 `has_locked_history()` RPC로만 확인한다
