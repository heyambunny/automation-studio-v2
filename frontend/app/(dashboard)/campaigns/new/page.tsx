"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Check, Send, FileSpreadsheet, Mail, Settings, Copy, CheckCircle2, Eye, Paperclip, Loader2, CalendarClock, FileText } from "lucide-react";

const steps = ["Send Method", "Mapping & Files", "Content", "Preview", "Action"];
const variables = ["{{BranchName}}", "{{ReportType}}", "{{Summary}}", "{{Cell:B2}}", "{{SenderName}}"];

function SummaryTable({ previewData, previewBranch }: { previewData: any; previewBranch: string }) {
  return (
    <div className="my-3 border border-zinc-200 dark:border-white/10 rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-zinc-100 dark:bg-white/10">
            {previewData && previewData.length > 0 ? (
              Object.keys(previewData[0]).map((key) => (
                <th key={key} className="text-left px-3 py-2 font-medium text-[#0A0A0A]">{key}</th>
              ))
            ) : (
              <>
                <th className="text-left px-3 py-2 font-medium text-[#0A0A0A]">Column 1</th>
                <th className="text-left px-3 py-2 font-medium text-[#0A0A0A]">Column 2</th>
                <th className="text-left px-3 py-2 font-medium text-[#0A0A0A]">Column 3</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-zinc-100 dark:border-white/10">
            {previewData && previewData.length > 0 ? (
              Object.values(previewData[0]).map((val: any, i: number) => (
                <td key={i} className="px-3 py-2 dark:text-zinc-300">{String(val ?? "—")}</td>
              ))
            ) : (
              <>
                <td className="px-3 py-2 dark:text-zinc-300">{previewBranch}</td>
                <td className="px-3 py-2 dark:text-zinc-300">—</td>
                <td className="px-3 py-2 dark:text-zinc-300">—</td>
              </>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function NewCampaignPage() {
  const router = useRouter();
  
  // Clear old form data on fresh mount (when no recipe is passed)
  useEffect(() => {
    const savedRecipe = sessionStorage.getItem("campaign_recipe");
    const editRecipe = sessionStorage.getItem("campaign_recipe_edit");
    if (!savedRecipe && !editRecipe) {
      // Fresh campaign - clear old form data
      sessionStorage.removeItem("campaign_form_data");
      setCurrentStep(0);
    }
  }, []);
  const [currentStep, setCurrentStep] = useState(0);
  const [smtpProfiles, setSmtpProfiles] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState("");
  const [mappings, setMappings] = useState<any[]>([]);
  const [selectedMapping, setSelectedMapping] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [subject, setSubject] = useState("");
  const [reportType, setReportType] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [sheetName, setSheetName] = useState("Summary");
  const [summaryFormat, setSummaryFormat] = useState<"table" | "image">("table");
  const [attachFile, setAttachFile] = useState(true);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [bodyTemplates, setBodyTemplates] = useState<any[]>([]);
  const [subjectTemplates, setSubjectTemplates] = useState<any[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<"once" | "daily" | "weekly" | "monthly">("once");
  const [scheduleRunAt, setScheduleRunAt] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<any>(null);
  const [copiedVar, setCopiedVar] = useState("");
  const [saveName, setSaveName] = useState("");
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [previewBranch, setPreviewBranch] = useState("Mumbai");
  const [recipeLoaded, setRecipeLoaded] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [editingRecipeFilename, setEditingRecipeFilename] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [mappedBranches, setMappedBranches] = useState<string[]>([]);
  const [readyBranches, setReadyBranches] = useState<string[]>([]);
  const [summaryHtml, setSummaryHtml] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
    
    // Check for saved recipe
    const savedRecipe = sessionStorage.getItem("campaign_recipe");
    const editRecipe = sessionStorage.getItem("campaign_recipe_edit");
    
    if (savedRecipe || editRecipe) {
      const recipe = JSON.parse((savedRecipe || editRecipe) as string);
      // Consume immediately: otherwise a leftover key from an earlier Run/Edit
      // click hangs around in sessionStorage and gets picked up (with priority
      // over whichever recipe was just clicked) the next time this page mounts.
      sessionStorage.removeItem("campaign_recipe");
      sessionStorage.removeItem("campaign_recipe_edit");
      setRecipeName(recipe.saved_name || "Saved Campaign");

      // Pre-fill form from recipe (top-level keys)
      setSelectedProfile(recipe.smtp_profile || recipe.config?.smtp_profile || "");
      setSelectedMapping(recipe.mapping || recipe.config?.mapping || "");
      setSubject(recipe.subject || recipe.config?.subject || "");
      setReportType(recipe.report_type || recipe.config?.report_type || "");
      setBodyTemplate(recipe.body_template || recipe.config?.body_template || "");
      setSheetName(recipe.sheet_name || recipe.config?.sheet_name || "Summary");
      setSummaryFormat((recipe.summary_format || recipe.config?.summary_format) === "image" ? "image" : "table");
      const recipeAttachFile = recipe.attach_file ?? recipe.config?.attach_file;
      setAttachFile(recipeAttachFile === undefined ? true : !!recipeAttachFile);
      setSaveName(recipe.saved_name || "");

      // Run: the recipe never stores the branch files themselves, so every run
      // needs this run's files picked before anything can be sent - land on
      // Mapping & Files (step 2). Edit starts from the top (step 1).
      if (savedRecipe) {
        setCurrentStep(1);
      } else if (editRecipe && recipe.filename) {
        // Editing an existing recipe: Save Recipe should update it in place
        // rather than create a duplicate.
        setEditingRecipeFilename(recipe.filename);
      }

      setRecipeLoaded(true);
    } else {
      // Check for saved form data from previous navigation
      const savedForm = sessionStorage.getItem("campaign_form_data");
      if (savedForm) {
        const data = JSON.parse(savedForm);
        setSelectedProfile(data.selectedProfile || "");
        setSelectedMapping(data.selectedMapping || "");
        setSubject(data.subject || "");
        setReportType(data.reportType || "");
        setBodyTemplate(data.bodyTemplate || "");
        setSheetName(data.sheetName || "Summary");
        setSummaryFormat(data.summaryFormat === "image" ? "image" : "table");
        setAttachFile(data.attachFile === undefined ? true : !!data.attachFile);
        if (data.currentStep) {
          setCurrentStep(data.currentStep);
        }
      }
    }
  }, []);

  const loadInitialData = async () => {
    try {
      const [profiles, mappingsData] = await Promise.all([api.getSMTPProfiles(), api.getMappings()]);
      setSmtpProfiles(profiles);
      setMappings(mappingsData);
    } catch (err: any) {
      console.error("Failed to load data");
      if (err?.status === 401) {
        window.location.href = "/login";
      }
    }
    try {
      const templates = await api.getTemplates();
      setBodyTemplates(templates.filter((t: any) => t.template_type === "body"));
      setSubjectTemplates(templates.filter((t: any) => t.template_type === "subject"));
    } catch (err) {
      console.error("Failed to load templates");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    setFiles(fileList);
    if (fileList && fileList.length > 0) {
      const file = fileList[0];
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xlsb")) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          try {
            const XLSX = await import("xlsx");
            const workbook = XLSX.read(data, { type: "array" });
            setSheetNames(workbook.SheetNames);
            if (workbook.SheetNames.length > 0) setSheetName(workbook.SheetNames[0]);
          } catch (err) {
            console.error("Failed to read sheets");
          }
        };
        reader.readAsArrayBuffer(file);
      }
    }
  };

  useEffect(() => {
    // Get mapped branches and files matching
    if (selectedMapping && mappings.length > 0 && files && files.length > 0) {
      const mapping = mappings.find(m => m.mapping_name === selectedMapping);
      // Fetch mapping entries
      api.getMappingEntries(mapping?.id).then((entries: any[]) => {
        const mappedNames = entries.map(e => e.branch_name);
        const fileNames = Array.from(files).map(f => f.name.replace(/\.(xlsx|xls|xlsb|csv)$/i, ""));
        
        // Only branches that are BOTH in mapping AND have a file
        const ready = mappedNames.filter(name => 
          fileNames.some(fn => fn.toLowerCase() === name.toLowerCase())
        );
        
        setMappedBranches(mappedNames);
        setReadyBranches(ready);
      }).catch(() => {
        setMappedBranches([]);
        setReadyBranches([]);
      });
    }
  }, [selectedMapping, files, mappings]);

  const loadPreviewData = async () => {
    if (!files || files.length === 0) return;
    const firstFile = files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const XLSX = await import("xlsx");
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[sheetName] || workbook.Sheets[workbook.SheetNames[0]];
        if (sheet) {
          const jsonData = XLSX.utils.sheet_to_json(sheet);
          if (jsonData.length > 0) {
            setPreviewData(jsonData.slice(0, 5));
            setPreviewBranch(firstFile.name.replace(/\.(xlsx|xls|xlsb|csv)$/i, ""));
          }
        }
      } catch (err) {
        console.error("Failed to read file for preview");
      }
    };
    reader.readAsArrayBuffer(firstFile);
  };

  useEffect(() => {
    loadPreviewData();
  }, [files, sheetName]);

  const findBranchFile = (branch: string): File | null => {
    if (!files) return null;
    const target = branch.trim().toLowerCase();
    for (let i = 0; i < files.length; i++) {
      const name = files[i].name.replace(/\.(xlsx|xls|xlsb|csv)$/i, "").trim().toLowerCase();
      if (name === target) return files[i];
    }
    return null;
  };

  // Render the {{Summary}} block exactly as recipients will see it
  useEffect(() => {
    if (currentStep !== 3 || !bodyTemplate?.includes("{{Summary}}")) {
      setSummaryHtml("");
      return;
    }
    const file = findBranchFile(previewBranch);
    if (!file) {
      setSummaryHtml("");
      return;
    }
    let cancelled = false;
    setSummaryLoading(true);
    api.previewSummary(file, sheetName, summaryFormat)
      .then((res) => { if (!cancelled) setSummaryHtml(res.html || ""); })
      .catch(() => { if (!cancelled) setSummaryHtml(""); })
      .finally(() => { if (!cancelled) setSummaryLoading(false); });
    return () => { cancelled = true; };
  }, [currentStep, previewBranch, sheetName, summaryFormat, files, bodyTemplate]);

  // Persist form data when navigating back
  useEffect(() => {
    const savedRecipe = sessionStorage.getItem("campaign_recipe");
    const editRecipe = sessionStorage.getItem("campaign_recipe_edit");
    if (recipeLoaded && !savedRecipe && !editRecipe) {
      sessionStorage.setItem("campaign_form_data", JSON.stringify({
        selectedProfile,
        selectedMapping,
        subject,
        reportType,
        bodyTemplate,
        sheetName,
        summaryFormat,
        attachFile,
        currentStep,
      }));
    }
  }, [selectedProfile, selectedMapping, subject, reportType, bodyTemplate, sheetName, summaryFormat, attachFile, currentStep, recipeLoaded]);



  const copyVariable = async (variable: string) => {
    await navigator.clipboard.writeText(variable);
    setCopiedVar(variable);
    setTimeout(() => setCopiedVar(""), 1500);
  };

  // Uploads this run's branch files and returns the resulting campaign_folder.
  // Shared by Send Now and Schedule - both need the files on disk before the
  // campaign (immediate or scheduled) can find them.
  const uploadCampaignFiles = async (): Promise<string> => {
    const formData = new FormData();
    if (files) {
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
    }
    const token = localStorage.getItem("access_token");
    const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/campaigns/upload-files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!uploadResponse.ok) throw new Error("File upload failed");
    const uploadResult = await uploadResponse.json();
    return uploadResult.campaign_folder || "";
  };

  const buildCampaignPayload = (campaignFolder: string) => ({
    smtp_profile: selectedProfile,
    mapping_id: mappings.find(m => m.mapping_name === selectedMapping)?.id,
    subject,
    body_template: bodyTemplate,
    report_type: reportType,
    sheet_name: sheetName,
    summary_format: summaryFormat,
    attach_file: attachFile,
    campaign_folder: campaignFolder,
  });

  const handleExecute = async () => {
    setExecuting(true);
    setExecutionResult(null);
    try {
      const campaignFolder = await uploadCampaignFiles();
      const result = await api.executeCampaign(buildCampaignPayload(campaignFolder));
      setExecutionResult(result);
    } catch (err: any) {
      setExecutionResult({ success: false, message: err.message || "Failed" });
    } finally {
      setExecuting(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleRunAt) return;
    setScheduling(true);
    setScheduleResult(null);
    try {
      const campaignFolder = await uploadCampaignFiles();
      const result = await api.createSchedule({
        schedule_name: saveName || reportType || "Scheduled Campaign",
        frequency: scheduleFrequency,
        run_at: scheduleRunAt,
        campaign: buildCampaignPayload(campaignFolder),
      });
      setScheduleResult({ success: true, ...result });
    } catch (err: any) {
      setScheduleResult({ success: false, message: err.message || "Failed to schedule" });
    } finally {
      setScheduling(false);
    }
  };

  const stepIcons = [Mail, FileSpreadsheet, Settings, Eye, Send];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const senderName = smtpProfiles.find(p => p.profile_name === selectedProfile)?.sender_name || "{{SenderName}}";

  return (
    <main className="max-w-4xl mx-auto px-8 py-8">
      {recipeLoaded && (
        <div className="mb-6 flex items-center justify-between bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Editing: {recipeName}
            </p>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem("campaign_recipe");
              sessionStorage.removeItem("campaign_recipe_edit");
              sessionStorage.removeItem("campaign_form_data");
              setRecipeLoaded(false);
              setRecipeName("");
              setEditingRecipeFilename(null);
              setSaveName("");
              setCurrentStep(0);
              setSelectedProfile("");
              setSelectedMapping("");
              setSubject("");
              setReportType("");
              setBodyTemplate("");
              router.push("/campaigns/new");
            }}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 bg-white dark:bg-transparent border border-blue-200 dark:border-blue-500/20 rounded-lg px-3 py-1.5 cursor-pointer transition-colors"
          >
            ✕ Exit Campaign
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[#0A0A0A] dark:text-white">New Campaign</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Create and send branch reports</p>
        </div>
        <span className="text-xs text-white bg-[#0A0A0A] border border-white/20 px-3 py-1 rounded-full">Step {currentStep + 1} of {steps.length}</span>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center mb-8">
        {steps.map((step, idx) => {
          const StepIcon = stepIcons[idx];
          const isComplete = idx < currentStep;
          const isActive = idx === currentStep;
          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <motion.div animate={{ scale: isActive ? 1.1 : 1 }} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isComplete ? "bg-[#0A0A0A] border border-white/30" : isActive ? "bg-[#0A0A0A] border border-white/20" : "bg-zinc-200 dark:bg-white/10"}`}>
                  {isComplete ? <Check className="w-4 h-4 text-white" /> : <StepIcon className={`w-4 h-4 ${isActive ? "text-white" : "text-zinc-500 dark:text-zinc-400"}`} />}
                </motion.div>
                <span className={`text-[10px] mt-1.5 font-medium ${isActive ? "text-[#0A0A0A] dark:text-white" : "text-zinc-400 dark:text-zinc-500"}`}>{step}</span>
              </div>
              {idx < steps.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${idx < currentStep ? "bg-zinc-400 dark:bg-white/20" : "bg-zinc-200 dark:bg-white/5"}`} />}
            </div>
          );
        })}
      </div>

      <Progress value={progress} className="h-1 mb-8 dark:bg-white/5 [&>div]:dark:bg-white/40" />

      {(currentStep === 0 && !selectedProfile && smtpProfiles.length > 0) && (
        <p className="text-amber-600 text-sm mb-2">⚠️ Please select an SMTP profile to continue</p>
      )}
      {(currentStep === 1 && !selectedMapping && mappings.length > 0) && (
        <p className="text-amber-600 text-sm mb-2">⚠️ Please select a mapping to continue</p>
      )}
      {(currentStep === 2 && (!reportType.trim() || !subject.trim() || !bodyTemplate.trim())) && (
        <p className="text-amber-600 text-sm mb-2">⚠️ Please fill in Report Type, Subject, and Email Body to continue</p>
      )}

      <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
        {/* Step 1 */}
        {currentStep === 0 && (
          <Card className="border-zinc-100 shadow-sm dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 dark:shadow-none">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-1 dark:text-white">Choose Send Method</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Select how you want to send emails</p>
              {smtpProfiles.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No profiles found. <button onClick={() => router.push("/settings")} className="text-[#0A0A0A] dark:text-white underline">Add in Settings</button></p>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs text-zinc-600 dark:text-zinc-400">SMTP Profile</Label>
                  <div className="space-y-2">
                    {smtpProfiles.map((p: any) => (
                      <button key={p.id} onClick={() => setSelectedProfile(p.profile_name)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${selectedProfile === p.profile_name ? "border-zinc-400 dark:border-white/50 bg-zinc-50 dark:bg-white/10" : "border-zinc-200 hover:border-zinc-300 dark:border-white/10 dark:hover:border-white/20 dark:bg-transparent"}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedProfile === p.profile_name ? "bg-[#0A0A0A] dark:bg-white" : "bg-zinc-100 dark:bg-white/10"}`}>
                          <Mail className={`w-4 h-4 ${selectedProfile === p.profile_name ? "text-white dark:text-[#0A0A0A]" : "text-zinc-500 dark:text-zinc-400"}`} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium dark:text-white">{p.profile_name}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{p.sender_email}</p>
                        </div>
                        {selectedProfile === p.profile_name && <Check className="w-4 h-4 text-[#0A0A0A] dark:text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2 */}
        {currentStep === 1 && (
          <Card className="border-zinc-100 shadow-sm dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 dark:shadow-none">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-1 dark:text-white">Select Mapping & Upload Files</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Choose recipients and upload branch files</p>
              <div className="space-y-5">
                {mappings.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No mappings. <button onClick={() => router.push("/mappings")} className="text-[#0A0A0A] dark:text-white underline">Upload one first</button></p>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-600 dark:text-zinc-400">Mapping</Label>
                    <div className="space-y-2">
                      {mappings.map((m: any) => (
                        <button key={m.id} onClick={() => setSelectedMapping(m.mapping_name)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${selectedMapping === m.mapping_name ? "border-zinc-400 dark:border-white/50 bg-zinc-50 dark:bg-white/10" : "border-zinc-200 hover:border-zinc-300 dark:border-white/10 dark:hover:border-white/20 dark:bg-transparent"}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedMapping === m.mapping_name ? "bg-[#0A0A0A] dark:bg-white" : "bg-zinc-100 dark:bg-white/10"}`}>
                            <FileSpreadsheet className={`w-4 h-4 ${selectedMapping === m.mapping_name ? "text-white dark:text-[#0A0A0A]" : "text-zinc-500 dark:text-zinc-400"}`} />
                          </div>
                          <p className="text-sm font-medium flex-1 dark:text-white">{m.mapping_name}</p>
                          {selectedMapping === m.mapping_name && <Check className="w-4 h-4 text-[#0A0A0A] dark:text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-xs text-zinc-600 dark:text-zinc-400">Branch Files</Label>
                  <Input type="file" multiple accept=".xlsx,.xls,.xlsb,.csv" onChange={handleFileUpload} className="dark:bg-[#0A0A0A] dark:border-white/20 dark:text-white" />
                  {files && <p className="text-xs text-emerald-600">{files.length} files selected</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3 */}
        {currentStep === 2 && (
          <Card className="border-zinc-100 shadow-sm dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 dark:shadow-none">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-1 dark:text-white">Content Settings</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Write your email template</p>

              <div className="mb-5 bg-zinc-50 dark:bg-white/5 dark:border dark:border-white/10 rounded-xl p-4">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-3">📌 Click to copy variable</p>
                <div className="flex flex-wrap gap-2">
                  {variables.map((variable) => (
                    <button key={variable} onClick={() => copyVariable(variable)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#0A0A0A] border border-zinc-200 dark:border-white/20 rounded-lg text-xs font-mono dark:text-white hover:border-zinc-400 dark:hover:border-white/40 transition-all cursor-pointer">
                      {copiedVar === variable ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                      {variable}
                    </button>
                  ))}
                </div>
              </div>

              {(bodyTemplates.length > 0 || subjectTemplates.length > 0) && (
                <div className="mb-5 bg-zinc-50 dark:bg-white/5 dark:border dark:border-white/10 rounded-xl p-4">
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-3 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Use a saved template</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-zinc-500 dark:text-zinc-400">Subject</Label>
                      <select
                        value=""
                        onChange={(e) => { if (e.target.value) setSubject(e.target.value); }}
                        disabled={subjectTemplates.length === 0}
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-white/20 dark:bg-[#0A0A0A] dark:text-white rounded-md text-sm bg-white disabled:opacity-50"
                      >
                        <option value="">{subjectTemplates.length === 0 ? "No subject templates" : "Select a template…"}</option>
                        {subjectTemplates.map((t: any) => <option key={t.id} value={t.content}>{t.template_name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-zinc-500 dark:text-zinc-400">Email Body</Label>
                      <select
                        value=""
                        onChange={(e) => { if (e.target.value) setBodyTemplate(e.target.value); }}
                        disabled={bodyTemplates.length === 0}
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-white/20 dark:bg-[#0A0A0A] dark:text-white rounded-md text-sm bg-white disabled:opacity-50"
                      >
                        <option value="">{bodyTemplates.length === 0 ? "No body templates" : "Select a template…"}</option>
                        {bodyTemplates.map((t: any) => <option key={t.id} value={t.content}>{t.template_name}</option>)}
                      </select>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2">Picking a template replaces the field below. Manage templates on the Templates page.</p>
                </div>
              )}

              <div className="space-y-4">
                {/* Attachment toggle first */}
                <div className="flex items-center gap-2 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg px-4 py-3">
                  <input
                    type="checkbox"
                    checked={attachFile}
                    onChange={(e) => setAttachFile(e.target.checked)}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <Label className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer" onClick={() => setAttachFile(v => !v)}>📎 Attach Excel file to email</Label>
                </div>

                <div className="space-y-1.5"><Label className="text-xs text-zinc-600 dark:text-zinc-400">Report Type</Label><Input value={reportType} className="dark:bg-[#0A0A0A] dark:border-white/20 dark:text-white" onChange={(e) => setReportType(e.target.value)} placeholder="e.g. Performance Report" /></div>
                <div className="space-y-1.5"><Label className="text-xs text-zinc-600 dark:text-zinc-400">Subject Template</Label><Input value={subject} className="dark:bg-[#0A0A0A] dark:border-white/20 dark:text-white" onChange={(e) => setSubject(e.target.value)} placeholder="e.g. {{ReportType}} - {{BranchName}}" /></div>
                <div className="space-y-1.5"><Label className="text-xs text-zinc-600 dark:text-zinc-400">Email Body</Label><Textarea value={bodyTemplate} className="dark:bg-[#0A0A0A] dark:border-white/20 dark:text-white" onChange={(e) => setBodyTemplate(e.target.value)} rows={8} placeholder="Dear {{BranchName}} Team,..." /></div>
                
                <div className="space-y-1.5 max-w-xs">
                  <Label className="text-xs text-zinc-600 dark:text-zinc-400">Sheet Name</Label>
                  {sheetNames.length > 0 ? (
                    <select value={sheetName} onChange={(e) => setSheetName(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 dark:border-white/20 dark:bg-[#0A0A0A] dark:text-white rounded-md text-sm bg-white">
                      {sheetNames.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  ) : <Input value={sheetName} className="dark:bg-[#0A0A0A] dark:border-white/20 dark:text-white" onChange={(e) => setSheetName(e.target.value)} />}
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">The table range is auto-detected and its formatting is copied from Excel as-is.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-600 dark:text-zinc-400">Summary format</Label>
                  <div className="inline-flex rounded-lg border border-zinc-200 dark:border-white/20 overflow-hidden">
                    {([["table", "Table"], ["image", "Image"]] as const).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setSummaryFormat(val)}
                        className={`px-4 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                          summaryFormat === val
                            ? "bg-[#0A0A0A] text-white dark:bg-white dark:text-[#0A0A0A]"
                            : "bg-white text-zinc-600 dark:bg-[#0A0A0A] dark:text-zinc-300"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    {summaryFormat === "table"
                      ? "Selectable HTML table. Reproduces fills, fonts, borders and conditional formatting."
                      : "A picture of the range rendered by Excel's engine — an exact visual copy (conditional formatting, icons, fonts). Not selectable text."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Preview */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <Card className="border-zinc-100 shadow-sm dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 dark:shadow-none">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-1 dark:text-white">Email Preview</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                  {readyBranches.length} branches ready to send · {mappedBranches.length} in mapping
                </p>
                
                {readyBranches.length > 0 && (
                  <div className="mb-4">
                    <Label className="text-xs text-zinc-600 dark:text-zinc-400 mb-2 block">Select branch to preview</Label>
                    <select 
                      value={previewBranch}
                      onChange={(e) => setPreviewBranch(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-white/20 dark:bg-[#0A0A0A] dark:text-white rounded-md text-sm bg-white"
                    >
                      {readyBranches.map((branch) => (
                        <option key={branch} value={branch}>{branch}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {readyBranches.length === 0 && (
                  <p className="text-amber-600 text-sm mb-4">⚠️ No branches ready — check your mapping and uploaded files</p>
                )}

                <div className="max-w-xl mx-auto border border-zinc-200 dark:border-white/10 rounded-xl overflow-hidden">
                  <div className="bg-zinc-50 dark:bg-[#0A0A0A] px-5 py-4 border-b border-zinc-200 dark:border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 bg-[#0A0A0A] dark:bg-white rounded-full flex items-center justify-center text-white dark:text-[#0A0A0A] text-xs font-bold">
                        {senderName[0] || "A"}
                      </div>
                      <div>
                        <p className="text-xs font-medium dark:text-white">{senderName}</p>
                        <p className="text-[10px] text-zinc-400">Sender</p>
                      </div>
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-300 space-y-1">
                      <p><span className="font-medium text-zinc-400 inline-block w-14">To:</span> Branch Recipients</p>
                      <p><span className="font-medium text-zinc-400 inline-block w-14">Subject:</span> {subject.replace(/{{BranchName}}/g, previewBranch).replace(/{{ReportType}}/g, reportType || "Report") || "—"}</p>
                    </div>
                  </div>

                  <div className="px-5 py-6 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {(() => {
                      const resolvedBody = (bodyTemplate || "—")
                        .replace(/{{BranchName}}/g, previewBranch)
                        .replace(/{{ReportType}}/g, reportType || "Report")
                        .replace(/{{SenderName}}/g, senderName);
                      
                      if (!bodyTemplate?.includes("{{Summary}}")) {
                        return <div className="whitespace-pre-wrap">{resolvedBody}</div>;
                      }
                      
                      const parts = resolvedBody.split("{{Summary}}");
                      return (
                        <div className="whitespace-pre-wrap">
                          {parts[0]}
                          {summaryLoading ? (
                            <div className="my-3 flex items-center gap-2 text-xs text-zinc-400">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Rendering summary from Excel…
                            </div>
                          ) : summaryHtml ? (
                            <div
                              className="my-3 overflow-x-auto"
                              dangerouslySetInnerHTML={{ __html: summaryHtml }}
                            />
                          ) : (
                            <SummaryTable previewData={previewData} previewBranch={previewBranch} />
                          )}
                          {parts.slice(1).join("")}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="bg-zinc-50 dark:bg-[#0A0A0A] px-5 py-3 border-t border-zinc-200 dark:border-white/10 flex items-center gap-2">
                    <Paperclip className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{attachFile && files ? `${files.length} files attached` : "No attachments"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading Overlay */}
        {executing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-white/10 rounded-2xl p-8 text-center shadow-2xl">
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-[#0A0A0A] dark:text-white mb-4" />
              <p className="font-semibold text-lg dark:text-white">Sending Emails...</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">Please wait while your campaign is being processed</p>
            </div>
          </div>
        )}

        {/* Step 5: Action */}
        {currentStep === 4 && (
          <Card className="border-zinc-100 shadow-sm dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 dark:shadow-none">
            <CardContent className="p-6 text-center py-12">
              <div className="w-16 h-16 bg-zinc-100 dark:bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="w-8 h-8 text-zinc-700 dark:text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-1 dark:text-white">Ready to Send</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">Your campaign is ready</p>
              <div className="space-y-4">
                <div className="max-w-xs mx-auto">
                  <Label className="text-xs text-zinc-600 dark:text-zinc-400 mb-2 block text-left">Campaign Name (for saving)</Label>
                  <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="e.g. Monthly MS Scheme Report" className="dark:bg-[#0A0A0A] dark:border-white/20 dark:text-white" />
                </div>
                <div className="flex gap-3 justify-center">
                  <Button size="lg" onClick={handleExecute} disabled={executing} className="bg-[#0A0A0A] text-white border border-white/20 hover:bg-zinc-800 hover:border-white/40">
                    {executing ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                    ) : (
                      <><Send className="w-4 h-4 mr-2" />Send Now</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="dark:border-white/20 dark:text-white dark:hover:bg-white/10"
                    onClick={() => {
                      if (!scheduleRunAt) {
                        const d = new Date(Date.now() + 60 * 60 * 1000);
                        d.setSeconds(0, 0);
                        const pad = (n: number) => String(n).padStart(2, "0");
                        setScheduleRunAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                      }
                      setScheduleResult(null);
                      setScheduleOpen(true);
                    }}
                  >
                    <CalendarClock className="w-4 h-4 mr-2" />Schedule
                  </Button>
                  <Button variant="outline" size="lg" className="dark:border-white/20 dark:text-white dark:hover:bg-white/10" onClick={async () => {
                    if (saveName) {
                      const config = { smtp_profile: selectedProfile, mapping: selectedMapping, subject, report_type: reportType, body_template: bodyTemplate, sheet_name: sheetName, summary_format: summaryFormat, attach_file: attachFile };
                      if (editingRecipeFilename) {
                        await api.updateRecipe(editingRecipeFilename, { saved_name: saveName, config });
                      } else {
                        await api.saveRecipe({ saved_name: saveName, config });
                      }
                      router.push("/recipes");
                    }
                  }}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />{editingRecipeFilename ? "Update Recipe" : "Save Recipe"}
                  </Button>
                </div>
                {executionResult && (
                  <div className={`mt-4 p-4 rounded-lg text-sm ${executionResult.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {executionResult.success ? `✅ Campaign executed! ${executionResult.sent} sent, ${executionResult.failed} failed` : `❌ ${executionResult.message}`}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0} className="dark:border-white/20 dark:text-white dark:hover:bg-white/10">
          <ChevronLeft className="w-4 h-4 mr-1" />Back
        </Button>
        <Button 
          onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))} 
          disabled={
            currentStep === steps.length - 1 || 
            (currentStep === 0 && !selectedProfile) ||
            (currentStep === 1 && !selectedMapping) ||
            (currentStep === 2 && (!reportType.trim() || !subject.trim() || !bodyTemplate.trim()))
          } 
          className="bg-[#0A0A0A] text-white border border-white/20 hover:bg-zinc-800 hover:border-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next<ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-sm dark:bg-[#1A1A1A] dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Schedule Campaign</DialogTitle>
            <DialogDescription className="dark:text-zinc-400">
              {scheduleFrequency === "once"
                ? "Sends once at the time below, using the files you uploaded."
                : "Resends the same uploaded files on this recurring schedule - good for a fixed notice, not for numbers that change each time."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs dark:text-zinc-300">Frequency</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {(["once", "daily", "weekly", "monthly"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setScheduleFrequency(f)}
                    className={`py-1.5 rounded-md text-xs font-medium capitalize transition-colors cursor-pointer ${
                      scheduleFrequency === f
                        ? "bg-[#0A0A0A] text-white dark:bg-white dark:text-[#0A0A0A]"
                        : "bg-zinc-100 text-zinc-600 dark:bg-white/5 dark:text-zinc-300"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs dark:text-zinc-300">{scheduleFrequency === "once" ? "Send at" : "First run at"}</Label>
              <Input
                type="datetime-local"
                value={scheduleRunAt}
                onChange={(e) => setScheduleRunAt(e.target.value)}
                className="dark:bg-white/5 dark:border-white/10 dark:text-white"
              />
            </div>
            {scheduleResult && (
              <div className={`p-3 rounded-lg text-xs ${scheduleResult.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {scheduleResult.success
                  ? `✅ Scheduled — next run ${scheduleResult.next_run}`
                  : `❌ ${scheduleResult.message}`}
              </div>
            )}
            <Button
              onClick={handleSchedule}
              disabled={scheduling || !scheduleRunAt || !selectedProfile || !selectedMapping}
              className="w-full bg-[#0A0A0A] text-white hover:bg-zinc-800"
            >
              {scheduling ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scheduling...</>
              ) : (
                <><CalendarClock className="w-4 h-4 mr-2" />Confirm Schedule</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
