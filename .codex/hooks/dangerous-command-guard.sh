#!/usr/bin/env bash
# PreToolUse guard for Bash: 위험한 명령어(rm -rf, force push, reset --hard, DROP TABLE)를 차단한다.
# .claude/hooks 아래 Bash 매처와 동일한 정책을 Codex hook 스키마(exit code 2 + stderr)로 이식한 것.
set -euo pipefail

input=$(cat)
command_str=$(jq -r '.tool_input.command // empty' <<< "$input")

[[ -z "$command_str" ]] && exit 0

if echo "$command_str" | grep -qE 'rm\s+-rf|git\s+push\s+--force|git\s+reset\s+--hard|DROP\s+TABLE'; then
  echo "BLOCKED: 위험한 명령어가 감지되었습니다." >&2
  exit 2
fi

exit 0
