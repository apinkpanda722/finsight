#!/usr/bin/env bash
# Stop hook: lint/build/test를 실행하고 실패하면 계속 수정하도록 되돌린다.
#
# Claude Code와 Codex 둘 다 Stop hook이 exit code 2 + stderr(계속할 이유)일 때 세션을 이어가는
# 규약을 공유하므로, 툴별 어댑터 없이 이 스크립트 하나를 양쪽 설정이 그대로 가리킨다.
set -uo pipefail

input=$(cat 2>/dev/null || true)
cwd=$(jq -r '.cwd // empty' <<< "$input" 2>/dev/null)
[[ -z "$cwd" ]] && cwd="$(pwd)"

# step 0(Next.js 스캐폴딩)이 아직 실행되지 않아 package.json조차 없는 상태(문서/hook
# 정리 등 메타 작업 중)에서는 검증할 앱 코드가 없으므로 통과시킨다.
[[ -f "$cwd/package.json" ]] || exit 0

output=$(cd "$cwd" && npm run lint 2>&1 && npm run build 2>&1 && npm run test 2>&1)
status=$?

if [[ $status -ne 0 ]]; then
  echo "lint/build/test가 실패했습니다. 아래 출력을 확인하고 수정을 계속하세요:" >&2
  echo "$output" >&2
  exit 2
fi

exit 0
