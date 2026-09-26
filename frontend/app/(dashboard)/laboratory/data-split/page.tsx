"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLabJob } from "@/components/lab/lab-job-context";
import { ArrowLeft, Split, Loader2, FileSpreadsheet, Download, CheckCircle2, Layers } from "lucide-react";

type ColumnInfo = { name: string; unique_count: number; sample_values: string[]; recommended: boolean };

export default function DataSplitPage() {
  const router = useRouter();
  const { job, startSplit } = useLabJob();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [error, setError] = useState("");
  const [sheetNames, setSheetNames] = useState<string[] | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [selectedColumn, setSelectedColumn] = useState("");
  const splitting = job !== null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setColumns([]);
    setSelectedColumn("");
    setSheetNames(null);
    setAnalyzed(false);
    setAnalyzing(true);
    setError("");
    try {
      const result = await api.analyzeSplitFile(f);
      setSheetNames(result.sheet_names);
      setRowCount(result.row_count);
      const sorted = [...result.columns].sort((a, b) => Number(b.recommended) - Number(a.recommended));
      setColumns(sorted);
      setSelectedColumn(sorted.find((c) => c.recommended)?.name || "");
    } catch (err: any) {
      setError(err?.message || "Could not read this file");
      setColumns([]);
    } finally {
      setAnalyzing(false);
      setAnalyzed(true);
    }
  };

  const handleSplit = () => {
    if (!file || !selectedColumn || splitting) return;
    const groupCount = columns.find((c) => c.name === selectedColumn)?.unique_count || 0;
    setError("");
    // Kicked off from the shared lab-job provider (mounted in the dashboard
    // layout, not this page), so it keeps running - and shows a toast on
    // completion - even if the user navigates away before it finishes.
    startSplit(file, selectedColumn, groupCount, rowCount);
  };

  const reset = () => {
    setFile(null);
    setColumns([]);
    setSelectedColumn("");
    setSheetNames(null);
    setAnalyzed(false);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const sheetCount = sheetNames?.length ?? 1;

  return (
    <main className="max-w-2xl mx-auto px-8 py-8 dark:text-white">
      <button
        onClick={() => router.push("/laboratory")}
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-white mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Laboratory
      </button>

      <div className="flex items-center gap-3 mb-8">
        <Split className="w-6 h-6 text-zinc-400" />
        <div>
          <h2 className="text-2xl font-bold text-[#0A0A0A] dark:text-white">Data Split</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Split one master report into a file per branch</p>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-6 dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 space-y-5">
        <div className="space-y-1.5">
          <Label className="text-xs">Master file</Label>
          <Input ref={fileInputRef} type="file" accept=".xlsx,.xls,.xlsb,.csv" onChange={handleFileChange} disabled={analyzing || splitting} />
        </div>

        {analyzing && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Reading every sheet and checking for columns they all share...
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {sheetNames && sheetNames.length > 1 && (
          <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-50 dark:bg-white/5 rounded-lg px-3 py-2">
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>
              {sheetCount} sheets read ({sheetNames.join(", ")}) - splitting will apply to all of them together, one output file per group with every sheet inside.
            </span>
          </div>
        )}

        {analyzed && !error && columns.length === 0 && (
          <p className="text-sm text-zinc-500">
            No column is common to all {sheetCount} sheets, so there&apos;s nothing that can split every sheet consistently.
          </p>
        )}

        {columns.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Split by column</Label>
              <span className="text-[11px] text-zinc-400">{rowCount} row{rowCount === 1 ? "" : "s"} total</span>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {columns.map((col) => (
                <button
                  key={col.name}
                  onClick={() => setSelectedColumn(col.name)}
                  disabled={splitting}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors cursor-pointer ${
                    selectedColumn === col.name
                      ? "border-[#0A0A0A] dark:border-white bg-zinc-50 dark:bg-white/10"
                      : "border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {selectedColumn === col.name && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      <span className="font-medium text-sm dark:text-white truncate">{col.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {col.recommended && (
                        <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">
                          Recommended
                        </span>
                      )}
                      <span className="text-xs text-zinc-400">{col.unique_count} groups</span>
                    </div>
                  </div>
                  {col.sample_values.length > 0 && (
                    <p className="text-xs text-zinc-400 mt-1 truncate">
                      {col.sample_values.join(", ")}{col.unique_count > col.sample_values.length ? ", ..." : ""}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {columns.length > 0 && (
          <div className="space-y-2">
            <Button onClick={handleSplit} className="w-full" disabled={!selectedColumn || splitting}>
              {splitting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Splitting "{job?.fileName}"... {job?.progress}%</>
              ) : (
                <><Download className="w-4 h-4 mr-2" />Split & Download ({selectedColumn ? columns.find((c) => c.name === selectedColumn)?.unique_count : 0} files)</>
              )}
            </Button>
            {splitting && job && (
              <>
                <div className="h-1.5 bg-zinc-100 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0A0A0A] dark:bg-white rounded-full transition-all duration-300"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
                <p className="text-[11px] text-zinc-400">
                  Estimated ~{Math.ceil(job.estimatedMs / 1000)}s total. You can leave this page - it keeps running and you&apos;ll get a notification when it&apos;s done.
                </p>
              </>
            )}
          </div>
        )}

        {file && (
          <button onClick={reset} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer">
            Start over with a different file
          </button>
        )}
      </div>

      {!file && (
        <div className="mt-4 flex items-start gap-2 text-xs text-zinc-400">
          <FileSpreadsheet className="w-4 h-4 shrink-0 mt-0.5" />
          <p>Upload the consolidated report - all sheets are read together. Only columns present in every sheet (e.g. Branch) are offered as a split key, since those are the only ones that can split every sheet consistently. Each output file gets one group&apos;s rows from every sheet.</p>
        </div>
      )}
    </main>
  );
}
