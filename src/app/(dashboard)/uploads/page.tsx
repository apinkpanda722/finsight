import { StatementUploadManager } from "@/components/dashboard/statement-upload-manager"
import { requireUserId } from "@/lib/api/auth"
import { createClient } from "@/lib/supabase/server"
import type { StatementStatus } from "@/types/domain"

function statementStatus(value: string): StatementStatus {
  if (
    value === "uploading" ||
    value === "pending" ||
    value === "processing" ||
    value === "completed" ||
    value === "failed"
  ) {
    return value
  }

  throw new Error("Unknown statement status")
}

export default async function UploadsPage() {
  const userId = await requireUserId()
  const supabase = await createClient()

  const [profileResult, accountsResult, statementsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("accounts")
      .select("id, label")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("uploaded_statements")
      .select(
        "id, account_id, file_name, status, row_count, error_message, processing_lease_expires_at, created_at, updated_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ])

  if (profileResult.error || accountsResult.error || statementsResult.error) {
    throw new Error("업로드 정보를 불러올 수 없습니다.")
  }

  const plan = profileResult.data?.plan === "pro" ? "pro" : "free"
  const accounts = accountsResult.data ?? []
  const statements = (statementsResult.data ?? []).map((statement) => {
    const status = statementStatus(statement.status)
    const leaseExpired =
      status === "processing" &&
      statement.processing_lease_expires_at !== null &&
      new Date(statement.processing_lease_expires_at).getTime() < Date.now()

    return {
      statementId: statement.id,
      accountId: statement.account_id,
      fileName: statement.file_name,
      status,
      rowCount: statement.row_count,
      errorMessage: statement.error_message,
      createdAt: statement.created_at,
      updatedAt: statement.updated_at,
      retryable: status === "failed" || leaseExpired,
    }
  })

  return (
    <main className="p-6 sm:p-10">
      <div className="mx-auto max-w-[960px]">
        <header className="mb-8">
          <p className="text-sm font-medium text-muted-foreground">CSV 업로드</p>
          <h1 className="mt-2 font-heading text-4xl tracking-[-0.03em]">
            명세서 관리
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-body)]">
            원본 파일은 Supabase Storage에 직접 업로드되며, 서버에서 실제 크기와 CSV 구조를 다시 검증합니다.
          </p>
        </header>

        <StatementUploadManager
          plan={plan}
          initialAccounts={accounts}
          initialStatements={statements}
        />
      </div>
    </main>
  )
}
