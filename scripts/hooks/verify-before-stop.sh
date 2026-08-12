#!/usr/bin/env bash
# Stop hook: lint/build/test를 실행하고 실패하면 계속 수정하도록 되돌린다.
#
# Claude Code와 Codex 둘 다 Stop hook이 exit code 2 + stderr(계속할 이유)일 때 세션을 이어가는
# 규약을 공유하므로, 툴별 어댑터 없이 이 스크립트 하나를 양쪽 설정이 그대로 가리킨다.
set -uo pipefail

input=$(cat 2>/dev/null || true)
stop_hook_active=$(jq -r '.stop_hook_active // false' <<< "$input" 2>/dev/null)

# A blocking Stop hook asks the agent to continue and then runs Stop again.
# Do not rerun the same verification during that continuation or it loops forever.
[[ "$stop_hook_active" == "true" ]] && exit 0

cwd=$(jq -r '.cwd // empty' <<< "$input" 2>/dev/null)
[[ -z "$cwd" ]] && cwd="$(pwd)"

# step 0(Next.js 스캐폴딩)이 아직 실행되지 않아 package.json조차 없는 상태(문서/hook
# 정리 등 메타 작업 중)에서는 검증할 앱 코드가 없으므로 통과시킨다.
[[ -f "$cwd/package.json" ]] || exit 0

# 이번 세션에서 워킹트리에 남긴 변경이 없으면(읽기 전용 리뷰/분석 등) 검증할
# 대상이 없으므로 통과시킨다. node_modules가 없는 환경(예: 의존성 설치 단계가
# 없는 CI 리뷰 워크플로우)에서 무의미하게 lint/build/test가 실패해 멈추는 것도 막는다.
if git -C "$cwd" diff --quiet 2>/dev/null && git -C "$cwd" diff --cached --quiet 2>/dev/null; then
  exit 0
fi

output=$(cd "$cwd" && npm run lint 2>&1 && npm run build 2>&1 && npm run test 2>&1)
status=$?

if [[ $status -ne 0 ]]; then
  echo "lint/build/test가 실패했습니다. 아래 출력을 확인하고 수정을 계속하세요:" >&2
  echo "$output" >&2
  exit 2
fi

exit 0
