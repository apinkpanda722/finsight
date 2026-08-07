#!/usr/bin/env bash
# PreToolUse guard for apply_patch: src/**/*.ts(x) 수정 전 동일 이름 테스트 파일 존재를 강제한다 (test-first TDD).
#
# .claude/hooks/tdd-guard.sh의 Codex 버전. Codex의 apply_patch 도구는 Claude Code의 Write/Edit과 달리
# tool_input.file_path가 아니라 tool_input.command에 "*** Begin Patch ... *** End Patch" 형식의
# patch 텍스트 전체(여러 파일 operation을 한 번에 포함 가능)가 들어오므로, awk로 대상 파일 경로들을
# 추출한 뒤 파일마다 동일한 정책을 적용한다. (macOS 기본 bash 3.2에는 mapfile이 없어 awk로 처리한다.)
set -euo pipefail

input=$(cat)
patch=$(jq -r '.tool_input.command // empty' <<< "$input")
cwd=$(jq -r '.cwd // empty' <<< "$input")

[[ -z "$patch" ]] && exit 0
[[ -z "$cwd" ]] && cwd="$(pwd)"

is_exempt() {
  local file_path="$1"
  case "$file_path" in
    *.test.ts|*.test.tsx) return 0 ;;
    *.d.ts) return 0 ;;
    */src/components/ui/*|*/src/types/*|*/src/test/*|src/components/ui/*|src/types/*|src/test/*)
      return 0
      ;;
  esac
  [[ "$(basename -- "$file_path")" == "main.tsx" ]] && return 0
  return 1
}

reasons=()

check_path() {
  local file_path="$1"
  [[ "$file_path" == *"/src/"* || "$file_path" == src/* ]] || return 0
  [[ "$file_path" == *.ts || "$file_path" == *.tsx ]] || return 0
  is_exempt "$file_path" && return 0

  local test_path
  if [[ "$file_path" == *.tsx ]]; then
    test_path="${file_path%.tsx}.test.tsx"
  else
    test_path="${file_path%.ts}.test.ts"
  fi

  if [[ ! -f "$cwd/$test_path" ]]; then
    reasons+=("TDD 정책: $(basename -- "$file_path") 를 수정하기 전에 $(basename -- "$test_path") 테스트 파일을 먼저 작성하세요 (test-first).")
  fi
}

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

while IFS= read -r file_path; do
  [[ -z "$file_path" ]] && continue
  check_path "$file_path"
done <<< "$target_paths"

if [[ ${#reasons[@]} -gt 0 ]]; then
  printf '%s\n' "${reasons[@]}" >&2
  exit 2
fi

exit 0
