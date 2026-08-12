export function toWonLabel(amount: number): string {
  const formatted = amount.toLocaleString("ko-KR")
  return formatted + "원"
}
