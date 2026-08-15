"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

const hasPostHogConfig = Boolean(
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
    process.env.NEXT_PUBLIC_POSTHOG_HOST,
);

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    if (hasPostHogConfig) {
      posthog.captureException(error);
    }
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <main>
          <h1>문제가 발생했습니다</h1>
          <p>잠시 후 다시 시도해 주세요.</p>
          <button type="button" onClick={reset}>
            다시 시도
          </button>
        </main>
      </body>
    </html>
  );
}
