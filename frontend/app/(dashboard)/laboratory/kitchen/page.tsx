"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import {
  ArrowLeft, ChefHat, Loader2, FileSpreadsheet, CheckCircle2, AlertTriangle,
  Download, Send, ArrowRight,
} from "lucide-react";

type RuleRow = { coord: string; kind: string; description: string; resolved: boolean; rule: any };
type ColumnInfo = { name: string; unique_count: number; sample_values: string[]; recommended: boolean };

export default function KitchenPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const exampleInputRef = useRef<HTMLInputElement>(null);
  const masterInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"train" | "review" | "generate">("train");

  // Train
  const [exampleFiles, setExampleFiles] = useState<File[]>([]);
  const [summarySheet, setSummarySheet] = useState("Summary");
  const [rawSheet, setRawSheet] = useState("Raw Data");
  const [training, setTraining] = useState(false);
  const [trainError, setTrainError] = useState("");

  // Review
  const [recipe, setRecipe] = useState<any>(null);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [overrides, setOverrides] = useState<Record<string, any>>({});

  // Generate
  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [analyzingMaster, setAnalyzingMaster] = useState(false);
  const [masterColumns, setMasterColumns] = useState<ColumnInfo[]>([]);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [outputMode, setOutputMode] = useState<"download" | "campaign_folder">("download");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  const handleExampleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExampleFiles(Array.from(e.target.files || []));
    setTrainError("");
  };

  const handleTrain = async () => {
    if (exampleFiles.length < 2) {
      setTrainError("Upload at least 2 example reports so Kitchen can cross-check the formula pattern across branches");
      return;
    }
    setTraining(true);
    setTrainError("");
    try {
      const result = await api.trainKitchenRecipe(exampleFiles, summarySheet, rawSheet);
      setRecipe(result.recipe);
      setRules(result.rules);
      setOverrides({});
      setStep("review");
    } catch (err: any) {
      setTrainError(err?.message || "Could not learn a recipe from these examples");
    } finally {
      setTraining(false);
    }
  };

  const setOverride = (coord: string, patch: any) => {
    setOverrides((prev) => ({ ...prev, [coord]: patch }));
  };

  const isOverrideComplete = (override: any) => {
    if (!override) return false;
    if (override.mode === "this_branch_name") return true;
    if (override.kind === "manual_formula" || override.mode === "constant") {
      return override.value !== undefined && String(override.value).trim() !== "";
    }
    return false;
  };

  const allResolved = rules.length > 0 && rules.every((r) => r.resolved || isOverrideComplete(overrides[r.coord]));

  const handleMasterFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setMasterFile(f);
    setMasterColumns([]);
    setSelectedColumn("");
    setAnalyzingMaster(true);
    setGenerateError("");
    try {
      const result = await api.analyzeSplitFile(f);
      const sorted = [...result.columns].sort((a, b) => Number(b.recommended) - Number(a.recommended));
      setMasterColumns(sorted);
      setSelectedColumn(sorted.find((c) => c.recommended)?.name || "");
    } catch (err: any) {
      setGenerateError(err?.message || "Could not read this file");
    } finally {
      setAnalyzingMaster(false);
    }
  };

  const handleGenerate = async () => {
    if (!masterFile || !selectedColumn || !recipe) return;
    setGenerating(true);
    setGenerateError("");
    try {
      const result = await api.generateKitchenReport(masterFile, selectedColumn, recipe, overrides, outputMode);
      if (result.type === "blob") {
        const url = URL.createObjectURL(result.data as Blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "kitchen_reports.zip";
        a.click();
        URL.revokeObjectURL(url);
        showToast("Reports generated and downloaded", "success");
      } else {
        const data = result.data as { campaign_folder: string; campaign_folder_id: string; branches: string[]; warnings: Record<string, string[]> };
        sessionStorage.setItem("kitchen_campaign_folder", JSON.stringify(data));
        showToast(`${data.branches.length} branch report(s) ready - continuing to New Campaign`, "success");
        router.push("/campaigns/new");
        return;
      }
    } catch (err: any) {
      setGenerateError(err?.message || "Failed to generate reports");
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => {
    setStep("train");
    setExampleFiles([]);
    setRecipe(null);
    setRules([]);
    setOverrides({});
    setMasterFile(null);
    setMasterColumns([]);
    setSelectedColumn("");
    setTrainError("");
    setGenerateError("");
    if (exampleInputRef.current) exampleInputRef.current.value = "";
    if (masterInputRef.current) masterInputRef.current.value = "";
  };

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
        <ChefHat className="w-6 h-6 text-zinc-400" />
        <div>
          <h2 className="text-2xl font-bold text-[#0A0A0A] dark:text-white">Kitchen</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Learn a report's formula recipe from an example, then bake it for every branch</p>
        </div>
      </div>

      {/* Step: Train */}
      {step === "train" && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Example branch reports (2 or more)</Label>
            <Input
              ref={exampleInputRef}
              type="file"
              multiple
              accept=".xlsx,.xls"
              onChange={handleExampleFiles}
              disabled={training}
            />
            <p className="text-[11px] text-zinc-400">
              Each file should be named after its branch (e.g. Kanpur.xlsx) and already contain both a raw-data sheet and a finished Summary sheet with live formulas.
            </p>
            {exampleFiles.length > 0 && (
              <p className="text-xs text-emerald-600">{exampleFiles.length} example(s) selected: {exampleFiles.map((f) => f.name).join(", ")}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Summary sheet name</Label>
              <Input value={summarySheet} onChange={(e) => setSummarySheet(e.target.value)} disabled={training} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Raw data sheet name</Label>
              <Input value={rawSheet} onChange={(e) => setRawSheet(e.target.value)} disabled={training} />
            </div>
          </div>

          {trainError && (
            <Alert variant="destructive">
              <AlertDescription>{trainError}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleTrain} className="w-full" disabled={exampleFiles.length < 2 || training}>
            {training ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" />Learning the recipe...</>
            ) : (
              <><ChefHat className="w-4 h-4 mr-2" />Learn Recipe</>
            )}
          </Button>
        </div>
      )}

      {/* Step: Review */}
      {step === "review" && (
        <div className="space-y-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium dark:text-white">Review the recipe</p>
              <span className={`text-xs font-medium ${allResolved ? "text-emerald-600" : "text-amber-600"}`}>
                {rules.filter((r) => r.resolved || isOverrideComplete(overrides[r.coord])).length} of {rules.length} resolved
              </span>
            </div>
            <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
              {rules.map((r) => {
                const isOverridden = isOverrideComplete(overrides[r.coord]);
                const isResolved = r.resolved || isOverridden;
                const lowConfArgIndex = r.rule?.args?.findIndex((a: any) => a.mode === "low_confidence") ?? -1;

                return (
                  <div
                    key={r.coord}
                    className={`px-4 py-3 rounded-xl border text-sm ${
                      isResolved
                        ? "border-zinc-200 dark:border-white/10"
                        : "border-amber-300 dark:border-amber-500/40 bg-amber-50/50 dark:bg-amber-500/5"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {isResolved ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <p className="dark:text-white">{r.description}</p>
                    </div>

                    {!r.resolved && r.kind === "needs_review" && (
                      <div className="mt-2 ml-6 flex items-center gap-2">
                        <Label className="text-[11px] text-zinc-500 shrink-0">Use this value/formula for every branch:</Label>
                        <Input
                          className="h-7 text-xs"
                          placeholder="e.g. 0 or =B2/B3"
                          onChange={(e) => {
                            const raw = e.target.value;
                            const num = Number(raw);
                            const value = raw.trim() !== "" && !Number.isNaN(num) && !raw.startsWith("=") ? num : raw;
                            setOverride(r.coord, { kind: "manual_formula", value });
                          }}
                        />
                      </div>
                    )}

                    {!r.resolved && r.kind === "aggregate" && lowConfArgIndex >= 0 && (
                      <div className="mt-2 ml-6 flex items-center gap-2 flex-wrap">
                        <Label className="text-[11px] text-zinc-500 shrink-0">This filter value is:</Label>
                        <select
                          className="h-7 text-xs border border-zinc-200 dark:border-white/20 dark:bg-[#0A0A0A] rounded-md px-2"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value === "this_branch_name") {
                              setOverride(r.coord, { arg_index: lowConfArgIndex, mode: "this_branch_name" });
                            } else if (e.target.value === "constant") {
                              setOverride(r.coord, { arg_index: lowConfArgIndex, mode: "constant", value: "" });
                            }
                          }}
                        >
                          <option value="" disabled>Choose...</option>
                          <option value="this_branch_name">Each branch's own name</option>
                          <option value="constant">The same value for every branch</option>
                        </select>
                        {overrides[r.coord]?.mode === "constant" && (
                          <Input
                            className="h-7 text-xs w-32"
                            placeholder="value"
                            onChange={(e) => setOverride(r.coord, { arg_index: lowConfArgIndex, mode: "constant", value: e.target.value })}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={reset} className="flex-1">Start over</Button>
            <Button onClick={() => setStep("generate")} disabled={!allResolved} className="flex-1">
              Continue<ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Generate */}
      {step === "generate" && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Master raw-data file</Label>
            <Input ref={masterInputRef} type="file" accept=".xlsx,.xls,.xlsb,.csv" onChange={handleMasterFile} disabled={analyzingMaster || generating} />
            <p className="text-[11px] text-zinc-400">The same kind of file you'd give Data Split - every branch's rows in one workbook.</p>
          </div>

          {analyzingMaster && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Reading the master file...
            </div>
          )}

          {masterColumns.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Split by column</Label>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {masterColumns.map((col) => (
                  <button
                    key={col.name}
                    onClick={() => setSelectedColumn(col.name)}
                    disabled={generating}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border transition-colors cursor-pointer ${
                      selectedColumn === col.name
                        ? "border-[#0A0A0A] dark:border-white bg-zinc-50 dark:bg-white/10"
                        : "border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-sm dark:text-white">{col.name}</span>
                      <span className="text-xs text-zinc-400">{col.unique_count} branches</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedColumn && (
            <div className="space-y-2">
              <Label className="text-xs">Once generated</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOutputMode("download")}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium cursor-pointer ${
                    outputMode === "download" ? "border-[#0A0A0A] dark:border-white bg-zinc-50 dark:bg-white/10" : "border-zinc-200 dark:border-white/10"
                  }`}
                >
                  <Download className="w-4 h-4" /> Download files
                </button>
                <button
                  onClick={() => setOutputMode("campaign_folder")}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium cursor-pointer ${
                    outputMode === "campaign_folder" ? "border-[#0A0A0A] dark:border-white bg-zinc-50 dark:bg-white/10" : "border-zinc-200 dark:border-white/10"
                  }`}
                >
                  <Send className="w-4 h-4" /> Send to New Campaign
                </button>
              </div>
            </div>
          )}

          {generateError && (
            <Alert variant="destructive">
              <AlertDescription>{generateError}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("review")} disabled={generating} className="flex-1">Back</Button>
            <Button onClick={handleGenerate} disabled={!masterFile || !selectedColumn || generating} className="flex-1">
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating...</>
              ) : (
                <><FileSpreadsheet className="w-4 h-4 mr-2" />Generate</>
              )}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
