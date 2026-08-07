#!/usr/bin/env bash
# PreToolUse adapter for Claude Code (matcher: Write|Edit).
# tool_input.file_path는 파일 하나이므로 그대로 tdd-guard-core.sh에 넘긴다.
# 실제 TDD 예외 규칙은 전부 tdd-guard-core.sh에 있다.
set -euo pipefail

input=$(cat)
file_path=$(jq -r '.tool_input.file_path // empty' <<< "$input")
cwd=$(jq -r '.cwd // empty' <<< "$input")

[[ -z "$file_path" ]] && exit 0
[[ -z "$cwd" ]] && cwd="$(pwd)"

exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/tdd-guard-core.sh" "$cwd" "$file_path"
