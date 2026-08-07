#!/usr/bin/env bash
# Stop hook: lint/build/test를 실행하고 실패하면 계속 수정하도록 되돌린다.
#
# .claude/settings.json의 Stop hook과 동일한 명령을 실행하지만, Codex의 Stop 이벤트는
# exit code 2 + stderr(계속할 이유)일 때만 세션을 이어가므로 단순 커맨드 체이닝이 아니라
# 결과를 캡처해 그 규약에 맞게 변환한다.
set -uo pipefail

output=$(npm run lint 2>&1 && npm run build 2>&1 && npm run test 2>&1)
status=$?

if [[ $status -ne 0 ]]; then
  echo "lint/build/test가 실패했습니다. 아래 출력을 확인하고 수정을 계속하세요:" >&2
  echo "$output" >&2
  exit 2
fi

exit 0
