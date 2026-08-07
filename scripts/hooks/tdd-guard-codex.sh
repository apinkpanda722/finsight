#!/usr/bin/env bash
# PreToolUse adapter for Codex (matcher: apply_patch).
#
# Codex의 apply_patch 도구는 Claude Code의 Write/Edit과 달리 tool_input.file_path가 아니라
# tool_input.command에 "*** Begin Patch ... *** End Patch" 형식의 patch 텍스트 전체(여러 파일
# operation을 한 번에 포함 가능)가 들어오므로, awk로 대상 파일 경로들을 추출한 뒤
# tdd-guard-core.sh에 전달한다. 실제 TDD 예외 규칙은 전부 tdd-guard-core.sh에 있다.
# (macOS 기본 bash 3.2에는 mapfile이 없어 awk + while read로 처리한다.)
set -euo pipefail

input=$(cat)
patch=$(jq -r '.tool_input.command // empty' <<< "$input")
cwd=$(jq -r '.cwd // empty' <<< "$input")

[[ -z "$patch" ]] && exit 0
[[ -z "$cwd" ]] && cwd="$(pwd)"

# Add File / Update File 헤더에서 대상 경로를 뽑아낸다. Update File 바로 다음 줄이
# Move to면(리네임) 그 새 경로를 대상으로 쓴다. Delete File은 검사 대상이 아니다.
target_paths=$(awk '
  function flush() { if (pending != "") { print pending; pending = "" } }
  /^\*\*\* Add File: / { flush(); pending = $0; sub(/^\*\*\* Add File: /, "", pending); next }
  /^\*\*\* Update File: / { flush(); pending = $0; sub(/^\*\*\* Update File: /, "", pending); next }
  /^\*\*\* Delete File: / { flush(); next }
  /^\*\*\* Move to: / { pending = $0; sub(/^\*\*\* Move to: /, "", pending); next }
  { flush() }
  END { flush() }
' <<< "$patch")

paths=()
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  paths+=("$line")
done <<< "$target_paths"

[[ ${#paths[@]} -eq 0 ]] && exit 0

exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/tdd-guard-core.sh" "$cwd" "${paths[@]}"
