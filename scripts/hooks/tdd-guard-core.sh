#!/usr/bin/env bash
# TDD 정책 공통 코어: src/**/*.ts(x) 수정 전 동일 이름 테스트 파일 존재를 강제한다 (test-first).
#
# 사용법: tdd-guard-core.sh <cwd> <file_path> [<file_path> ...]
# 위반이 있으면 사유를 stderr에 출력하고 exit 2, 없으면 exit 0.
#
# Claude Code(tdd-guard-claude.sh)와 Codex(tdd-guard-codex.sh) 어댑터가 각자의 hook 입력
# 포맷(전자는 tool_input.file_path 하나, 후자는 tool_input.command의 patch 텍스트를 파싱한
# 여러 경로)에서 대상 파일 경로들을 뽑아낸 뒤 이 스크립트를 호출한다. TDD 예외 규칙은 이
# 파일에만 존재한다 — 어댑터마다 정책을 복사해두면 한쪽만 갱신되어 어긋나는 문제가 생긴다.
set -euo pipefail

cwd="${1:?cwd required}"
shift

is_exempt() {
  local file_path="$1"
  case "$file_path" in
    *.test.ts|*.test.tsx) return 0 ;;
    *.d.ts) return 0 ;;
    */src/components/ui/*|*/src/types/*|*/src/test/*|src/components/ui/*|src/types/*|src/test/*)
      return 0
      ;;
    */src/lib/supabase/*|*/src/lib/polar/*|*/src/lib/anthropic/*|src/lib/supabase/*|src/lib/polar/*|src/lib/anthropic/*)
      return 0
      ;;
    */src/lib/posthog/*|src/lib/posthog/*)
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

  local test_full_path
  if [[ "$test_path" == /* ]]; then
    test_full_path="$test_path"
  else
    test_full_path="$cwd/$test_path"
  fi

  if [[ ! -f "$test_full_path" ]]; then
    reasons+=("TDD 정책: $(basename -- "$file_path") 를 수정하기 전에 $(basename -- "$test_path") 테스트 파일을 먼저 작성하세요 (test-first).")
  fi
}

for file_path in "$@"; do
  [[ -z "$file_path" ]] && continue
  check_path "$file_path"
done

if [[ ${#reasons[@]} -gt 0 ]]; then
  printf '%s\n' "${reasons[@]}" >&2
  exit 2
fi

exit 0
