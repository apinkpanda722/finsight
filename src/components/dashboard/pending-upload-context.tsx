"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react"

import posthog from "posthog-js"

import { Button } from "@/components/ui/button"

type PendingUploadContextValue = {
  setPendingFile: (file: File) => void
  takePendingFile: () => File | null
  resetPostHog: () => void
}

const noopContextValue: PendingUploadContextValue = {
  setPendingFile: () => {},
  takePendingFile: () => null,
  resetPostHog: () => {},
}

const PendingUploadContext =
  createContext<PendingUploadContextValue>(noopContextValue)

export function PendingUploadProvider({
  children,
  userId,
  email,
}: {
  children: ReactNode
  userId: string
  email?: string
}) {
  const fileRef = useRef<File | null>(null)

  useEffect(() => {
    posthog.identify(userId, { email })
  }, [email, userId])

  const value = useMemo<PendingUploadContextValue>(
    () => ({
      setPendingFile: (file) => {
        fileRef.current = file
      },
      takePendingFile: () => {
        const file = fileRef.current
        fileRef.current = null
        return file
      },
      resetPostHog: () => posthog.reset(),
    }),
    []
  )

  return (
    <PendingUploadContext.Provider value={value}>
      {children}
    </PendingUploadContext.Provider>
  )
}

export function SignOutButton() {
  const { resetPostHog } = usePendingUpload()

  return (
    <Button
      type="submit"
      variant="ghost"
      className="w-full justify-start px-3 text-muted-foreground hover:text-foreground"
      onClick={resetPostHog}
    >
      로그아웃
    </Button>
  )
}

export function usePendingUpload(): PendingUploadContextValue {
  return useContext(PendingUploadContext)
}
