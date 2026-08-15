# PROGRAM.md — Lighthouse Auto-Research 제어 문서

> autoresearch의 `program.md` 대응. 루프를 다시 돌릴 일이 생기면 사람은 코드를 직접 만지지 않고
> **이 문서만 편집해** 탐색 방향을 제어한다. (jha0313/finsight `scripts/lh` 참고, finsight 실제
> 인증 아키텍처에 맞게 스코프/제약을 조정함.)

## 목적함수 (단일 지표)
```
objective = Σ(w_C · score(P,D,C)) / N_cells      # cell = page P × device D × category C
KEEP   ⇐ objective 상승 AND ∀cell: score ≥ baseline − ε   (ε = 1pt)
REVERT ⇐ 그 외
```
- 측정: `bash scripts/lh/run.sh` → `scripts/lh/scores.json` (페이지 4 × 기기 2 × 카테고리 4, median-of-3)
- 판정: `node scripts/lh/objective.mjs scripts/lh/baseline.json scripts/lh/scores.json`
- 가중치: 전 카테고리 동일(1.0). 기기: mobile·desktop 동일.

## 대상 / 측정 환경
- 페이지: `/`(landing) · `/login` · `/forgot-password` · `/reset-password` — 인증 없이 접근 가능한 공개 페이지만.
- **대시보드(`/dashboard`)는 스코프 밖.** 레퍼런스는 미들웨어 우회로 측정하지만, finsight는 페이지 자체가
  `requireUserId()`로 세션을 재검증하고 RLS로 데이터를 조회하므로 미들웨어만 우회하면 페이지가 정상 렌더링되지
  않는다. 실측하려면 Supabase에 실제 테스트 유저/세션을 시딩해야 하는데, 이는 DB에 실제 영향을 주는 별도 위험
  결정이라 이번 라운드에서는 채택하지 않았다.
- 카테고리: Performance · Accessibility · Best Practices · SEO
- 기기: mobile(기본 프리셋) · desktop(lighthouse desktop-config)
- 빌드: 격리 distDir `.next-lh`(및 후보별 `.next-lh-c{N}`), 포트 4187+. dev(`.next`)와 레이스 없음.
- `distDir` 오버라이드는 스톡 Next.js 기능이 아니라 `next.config.ts`에 `NEXT_DIST_DIR` env로 직접 추가한 것.
- 주의: `next build`가 커스텀 distDir 빌드 시 `tsconfig.json`의 `include`를 자동으로 건드린다.
  `measure.mjs`의 `build()`가 빌드 전후로 스냅샷/복원하므로 별도 조치 불필요.

## 목표 임계치
| 카테고리 | mobile | desktop |
|---|---|---|
| Performance | ≥ 95 | ≥ 95 |
| Accessibility | ≥ 95 | ≥ 95 |
| Best Practices | ≥ 95 | ≥ 95 |
| SEO | ≥ 95 | ≥ 95 |

중단: 모든 cell이 목표 도달 **또는** 2회 연속 무개선(dry) **또는** 5회 반복 안전 상한.

## 제약 (안전 레일 — 위반 시 그 변경 폐기)
- **외과적 수정만.** 변경된 모든 줄은 점수 개선과 직접 연결. 후보당 최대 2개 파일.
- **Vantage 디자인 토큰 준수.** CSS 변수만 사용, hex 인라인 금지.
- **매 반복 green**: `npm run lint && npm run test && npm run build`.
- **회귀 자동 revert**: 어떤 cell이든 baseline−1pt 미만이면 폐기.
- **불변 영역**: `src/middleware.ts`(인증 판단 로직), `next.config.ts`, `package.json`, `scripts/lh/*` — 후보가 손대면 그 변경 자체를 폐기.
- **TDD 훅 준수**: `src/**/*.ts(x)` 수정 전 동일 이름 테스트 파일 존재 필요.
- **측정 픽스처 커밋 금지**: `scores.json`/`reports/`/`.next-lh*`는 로컬 산출물로만 유지(`.gitignore` 처리됨).
- **커밋/PR 금지**: 이 루프는 파일만 수정한다. git 커밋·브랜치·PR은 사용자가 명시적으로 요청하기 전까지 하지 않는다.

## 백로그
> 2026-08-15 베이스라인 기준, 실제 개선 여지가 있는 항목 없음. 아래는 참고용 기록.

베이스라인이 이미 전 카테고리 99~100점(reset-password/mobile 제외)이라 ROI가 있는 백로그 항목이 없다.
reset-password/mobile=92는 코드 버그가 아니라 **의도된 보안 동작**의 부산물이므로 백로그에 올리지 않는다
(아래 반복 로그 참고). 향후 스코프가 넓어지면(예: 대시보드 포함, 또는 실제 재설정 토큰으로 폼 자체를 측정)
이 섹션을 `node scripts/lh/audits.mjs` 재실행 결과로 다시 채운다.

## 반복 로그
| # | 변경 | 결과(cell) | verdict |
|---|---|---|---|
| 0 | baseline (4페이지 × 2기기, median-of-3) | landing 99/100·A/BP/SEO 100 · login 99/100·100 · forgot-password 99/100·100 · reset-password 92/100·100 | — |

**반복 1을 실행하지 않고 종료.** 사유:
- 32개 cell 중 31개가 이미 목표(95)를 상회.
- 유일한 미달 cell(reset-password/mobile=92)은 토큰 없이 `/reset-password`에 접근할 때 서버가 정상적으로
  `/forgot-password`로 리다이렉트하면서 생기는 지연이 측정에 섞인 것 (`finalUrl` 로그로 확인). 실제 "새 비밀번호
  입력 폼"의 성능이 아니라 **보안 리다이렉트 오버헤드**를 측정한 결과다.
- 이 상태로 후보 에이전트를 돌리면 점수를 올리기 위해 토큰 검증/리다이렉트 로직(보안 경계)을 건드릴 위험이 있어
  autoresearch 루프를 강행하지 않기로 사용자와 합의.

## 알려진 한계 / 후속
- reset-password/mobile=92: 실측하려면 (a) 유효한 재설정 토큰을 발급해 실제 폼 페이지를 측정 대상으로 삼거나,
  (b) 이 cell을 objective/threshold 판정에서 영구적으로 제외해야 한다. 둘 다 이번 라운드에서는 보류.
- 대시보드는 여전히 스코프 밖. 측정하려면 Supabase 테스트 유저 시딩 전략을 별도로 설계해야 한다.
