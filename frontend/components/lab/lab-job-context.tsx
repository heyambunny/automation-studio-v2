"use client";

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

export type LabJob = {
  fileName: string;
  columnName: string;
  groupCount: number;
  startedAt: number;
  estimatedMs: number;
  progress: number; // 0-100, heuristic - only the actual response decides when it's really done
} | null;

const LabJobContext = createContext<{
  job: LabJob;
  startSplit: (file: File, columnName: string, groupCount: number, rowCount: number) => void;
} | null>(null);

// Calibrated against a real 5000-row, 2-sheet, 50-group split (~2.1s actual) -
// it's a rough estimate, not a guarantee, and the progress bar is corrected
// to 100% the moment the real response comes back regardless of this number.
function estimateSplitMs(rowCount: number, groupCount: number): number {
  return Math.max(1200, 300 + rowCount * 0.25 + groupCount * 10);
}

export function LabJobProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const [job, setJob] = useState<LabJob>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startSplit = useCallback((file: File, columnName: string, groupCount: number, rowCount: number) => {
    const estimatedMs = estimateSplitMs(rowCount, groupCount);
    const startedAt = Date.now();
    setJob({ fileName: file.name, columnName, groupCount, startedAt, estimatedMs, progress: 2 });

    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = setInterval(() => {
      setJob((prev) => {
        if (!prev) return prev;
        const elapsed = Date.now() - prev.startedAt;
        // Never let the heuristic claim 100% on its own - only a real response does that.
        const pct = Math.min(95, Math.round((elapsed / prev.estimatedMs) * 100));
        return { ...prev, progress: pct };
      });
    }, 250);

    // Deliberately not awaited by any page component - this runs from the
    // dashboard layout's provider, so it keeps going and still shows a toast
    // even if the user navigates to a different page before it finishes.
    api
      .splitFile(file, columnName)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "split_files.zip";
        a.click();
        URL.revokeObjectURL(url);
        showToast(`Split by "${columnName}" finished - ${groupCount} file(s) downloaded`, "success");
      })
      .catch((err: any) => {
        showToast(err?.message || "Failed to split file", "error");
      })
      .finally(() => {
        if (progressTimer.current) clearInterval(progressTimer.current);
        setJob(null);
      });
  }, [showToast]);

  return <LabJobContext.Provider value={{ job, startSplit }}>{children}</LabJobContext.Provider>;
}

export function useLabJob() {
  const ctx = useContext(LabJobContext);
  if (!ctx) throw new Error("useLabJob must be used within LabJobProvider");
  return ctx;
}
