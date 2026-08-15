#!/usr/bin/env bash
# scripts/lh/run.sh
# Lighthouse 측정 매트릭스(랜딩 페이지 × mobile/desktop × 4 카테고리, median-of-3)를 돌린다.
# 대시보드는 대상에서 제외되어 있으므로(page.tsx의 requireUserId()가 미들웨어 우회와
# 무관하게 실제 세션을 재검증함) 별도의 인증 우회 로직이 필요 없다.
#
# 사용: bash scripts/lh/run.sh [measure.mjs 인자]
#   bash scripts/lh/run.sh                # 전체 매트릭스(build 포함)
#   LH_RUNS=1 bash scripts/lh/run.sh      # 빠른 스모크
#   bash scripts/lh/run.sh --no-build     # 기존 dist 재사용
set -euo pipefail
cd "$(dirname "$0")/../.."   # repo root

node scripts/lh/measure.mjs "$@"
