/** usedCount는 이번 달에 이미 처리한 명세서 수, quota는 Free 플랜 월 한도다. */
export function isOverFreeQuota(usedCount: number, quota: number): boolean {
  return usedCount > quota
}
