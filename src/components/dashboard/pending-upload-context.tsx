"use client"

import { createContext, useContext, useMemo, useRef, type ReactNode } from "react"

type PendingUploadContextValue = {
  setPendingFile: (file: File) => void
  takePendingFile: () => File | null
}

const noopContextValue: PendingUploadContextValue = {
  setPendingFile: () => {},
  takePendingFile: () => null,
}

const PendingUploadContext =
  createContext<PendingUploadContextValue>(noopContextValue)

export function PendingUploadProvider({ children }: { children: ReactNode }) {
  const fileRef = useRef<File | null>(null)

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
    }),
    []
  )

  return (
    <PendingUploadContext.Provider value={value}>
      {children}
    </PendingUploadContext.Provider>
  )
}

export function usePendingUpload(): PendingUploadContextValue {
  return useContext(PendingUploadContext)
}
