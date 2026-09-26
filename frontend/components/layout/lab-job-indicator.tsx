"use client";

import { useLabJob } from "@/components/lab/lab-job-context";
import { Loader2 } from "lucide-react";

export function LabJobIndicator() {
  const { job } = useLabJob();
  if (!job) return null;

  const elapsedMs = Date.now() - job.startedAt;
  const remainingMs = Math.max(0, job.estimatedMs - elapsedMs);
  const remainingSec = Math.ceil(remainingMs / 1000);

  return (
    <div
      className="hidden sm:flex items-center gap-2 text-xs bg-zinc-100 dark:bg-white/10 rounded-lg px-3 py-1.5"
      title={`Splitting "${job.fileName}" by "${job.columnName}"`}
    >
      <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />
      <span className="text-zinc-600 dark:text-zinc-300">
        Splitting... {job.progress}%{remainingSec > 0 ? ` · ~${remainingSec}s left` : ""}
      </span>
    </div>
  );
}
