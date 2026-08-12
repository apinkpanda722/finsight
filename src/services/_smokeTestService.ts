import { createClient } from "@/lib/supabase/server"

// review-code Workflow 스모크 테스트용 임시 파일. CLAUDE.md CRITICAL 규칙(서비스 함수는
// Supabase 클라이언트를 deps로 주입받아야 한다)을 의도적으로 위반해 architecture 차원이
// 실제로 잡아내는지 확인한다. 확인 후 삭제될 파일이다.
export async function smokeTestFetchProfile(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single()
  return data
}
