#!/usr/bin/env bash
# PreToolUse guard for Write|Edit: blocks edits to src/**/*.ts(x) source files
# that don't yet have a colocated *.test.ts(x) file, enforcing test-first TDD.
set -euo pipefail

input=$(cat)
file_path=$(jq -r '.tool_input.file_path // empty' <<< "$input")

[[ -z "$file_path" ]] && exit 0

# Only guard TypeScript/TSX files under src/
[[ "$file_path" == *"/src/"* || "$file_path" == src/* ]] || exit 0
[[ "$file_path" == *.ts || "$file_path" == *.tsx ]] || exit 0

# Already a test file
[[ "$file_path" == *.test.ts || "$file_path" == *.test.tsx ]] && exit 0

# Type-only / generated / infra files are exempt
[[ "$file_path" == *.d.ts ]] && exit 0
case "$file_path" in
  */src/components/ui/*|*/src/types/*|*/src/test/*|src/components/ui/*|src/types/*|src/test/*)
    exit 0
    ;;
esac
base=$(basename "$file_path")
[[ "$base" == "main.tsx" ]] && exit 0

if [[ "$file_path" == *.tsx ]]; then
  test_path="${file_path%.tsx}.test.tsx"
else
  test_path="${file_path%.ts}.test.ts"
fi

[[ -f "$test_path" ]] && exit 0

reason="TDD 정책: $(basename "$file_path") 를 수정하기 전에 $(basename "$test_path") 테스트 파일을 먼저 작성하세요 (test-first)."
jq -n --arg reason "$reason" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $reason
  }
}'
