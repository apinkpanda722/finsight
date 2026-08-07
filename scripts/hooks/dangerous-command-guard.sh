#!/usr/bin/env bash
# PreToolUse guard for Bash: 위험한 명령어(rm -rf, force push, reset --hard, DROP TABLE)를 차단한다.
#
# Claude Code와 Codex 둘 다 PreToolUse 호출 시 tool_input.command에 동일한 셸 커맨드 문자열을
# stdin JSON으로 담아 주므로, 툴별 어댑터 없이 이 스크립트 하나를 양쪽 설정(.claude/settings.json,
# .codex/config.toml)이 그대로 가리킨다.
set -euo pipefail

input=$(cat)
command_str=$(jq -r '.tool_input.command // empty' <<< "$input")

[[ -z "$command_str" ]] && exit 0

if echo "$command_str" | grep -qE 'rm\s+-rf|git\s+push\s+--force|git\s+reset\s+--hard|DROP\s+TABLE'; then
  echo "BLOCKED: 위험한 명령어가 감지되었습니다." >&2
  exit 2
fi

exit 0
