"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Trash2, Eye, Upload, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";

const SAMPLE_CSV = "BranchName,To,CC\nMumbai,mumbai.manager@company.com;mumbai.assistant@company.com,regional.head@company.com\nDelhi,delhi.manager@company.com,regional.head@company.com;director@company.com\nBangalore,bangalore.manager@company.com,\n";
const ITEMS_PER_PAGE = 5;
const EXPECTED_COLUMNS = ["BranchName", "To", "CC"];
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

// A mapping CSV uses ',' to separate columns and ';' to separate multiple
// recipients within the To/CC cell - the two can't both be ',' or a cell
// like "a@x.com,b@x.com" would silently split into extra columns instead
// of staying one recipient list. This validates that shape before the
// mapping is ever saved, so a bad file can't later break email sending.
function validateMappingCsv(csvContent: string): { entries: { BranchName: string; To: string; CC: string }[]; errors: string[] } {
  const errors: string[] = [];
  const lines = csvContent.trim().split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) {
    return { entries: [], errors: ["CSV file is empty"] };
  }

  const headers = lines[0].split(",").map((h) => h.trim());
  const unknownCols = headers.filter((h) => !EXPECTED_COLUMNS.includes(h));
  if (unknownCols.length > 0) {
    errors.push(`Unexpected column(s): ${unknownCols.join(", ")} - only BranchName, To, CC are allowed`);
  }
  if (!headers.includes("BranchName") || !headers.includes("To")) {
    errors.push("CSV must have BranchName and To columns");
    return { entries: [], errors };
  }
  const branchIdx = headers.indexOf("BranchName");
  const toIdx = headers.indexOf("To");
  const ccIdx = headers.indexOf("CC");

  const entries: { BranchName: string; To: string; CC: string }[] = [];
  const seenBranches = new Map<string, number>();

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1; // 1-indexed, matches what a user sees in Excel/a text editor
    const values = lines[i].split(",");
    if (values.length !== headers.length) {
      errors.push(`Row ${rowNum}: expected ${headers.length} column(s) but found ${values.length} - use ';' to separate multiple emails in one cell, not ','`);
      continue;
    }

    const branchName = values[branchIdx]?.trim() || "";
    const to = values[toIdx]?.trim() || "";
    const cc = ccIdx >= 0 ? (values[ccIdx]?.trim() || "") : "";

    if (!branchName) {
      errors.push(`Row ${rowNum}: BranchName is required`);
      continue;
    }
    const key = branchName.toLowerCase();
    if (seenBranches.has(key)) {
      errors.push(`Row ${rowNum}: duplicate BranchName "${branchName}" (already used in row ${seenBranches.get(key)})`);
      continue;
    }
    seenBranches.set(key, rowNum);

    if (!to) {
      errors.push(`Row ${rowNum} (${branchName}): To is required`);
      continue;
    }
    const toEmails = to.split(";").map((e) => e.trim()).filter(Boolean);
    const badTo = toEmails.filter((e) => !EMAIL_RE.test(e));
    if (badTo.length > 0) {
      errors.push(`Row ${rowNum} (${branchName}): invalid email in To - "${badTo.join('", "')}"`);
      continue;
    }

    const ccEmails = cc ? cc.split(";").map((e) => e.trim()).filter(Boolean) : [];
    const badCc = ccEmails.filter((e) => !EMAIL_RE.test(e));
    if (badCc.length > 0) {
      errors.push(`Row ${rowNum} (${branchName}): invalid email in CC - "${badCc.join('", "')}"`);
      continue;
    }

    entries.push({ BranchName: branchName, To: to, CC: cc });
  }

  return { entries, errors };
}

export default function MappingsPage() {
  const [mappings, setMappings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mappingName, setMappingName] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMapping, setViewMapping] = useState<any>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [error, setError] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    try {
      const data = await api.getMappings();
      setMappings(data);
    } catch (err) {
      console.error("Failed to load mappings");
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(mappings.length / ITEMS_PER_PAGE);
  const paginatedMappings = mappings.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError([]);
    const reader = new FileReader();
    reader.onload = (event) => setCsvContent(event.target?.result as string);
    reader.readAsText(file);
  };

  const handleSaveMapping = async () => {
    setError([]);
    if (!mappingName.trim()) { setError(["Please enter a mapping name"]); return; }
    if (!csvContent.trim()) { setError(["Please upload a CSV file"]); return; }

    const { entries, errors } = validateMappingCsv(csvContent);
    if (errors.length > 0) { setError(errors); return; }
    if (entries.length === 0) { setError(["CSV has no data rows"]); return; }

    try {
      await api.createMapping({ mapping_name: mappingName, entries });
      setDialogOpen(false);
      setMappingName("");
      setCsvContent("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadMappings();
      setCurrentPage(1);
    } catch (err: any) {
      const detail = err?.message;
      setError([typeof detail === "string" && detail ? detail : "Failed to save mapping"]);
    }
  };

  const handleDelete = async (id: number) => {
    await api.deleteMapping(id);
    setDeleteConfirm(null);
    await loadMappings();
    if (paginatedMappings.length === 1 && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const viewEntries = async (mappingId: number) => {
    const entries = await api.getMappingEntries(mappingId);
    setViewMapping(entries);
    setViewOpen(true);
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_mapping.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="max-w-5xl mx-auto px-8 py-8 dark:text-white">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[#0A0A0A] dark:text-white">Branch Mappings</h2>
          <p className="text-sm text-zinc-500 mt-1">Link branch names to email recipients</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadSample}>
            <Download className="w-4 h-4 mr-2" />
            Sample CSV
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger className="inline-flex items-center gap-2 bg-[#0A0A0A] text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              Upload Mapping
            </DialogTrigger>
            <DialogContent className="sm:max-w-md dark:bg-[#1A1A1A] dark:border-white/10">
              <DialogHeader>
                <DialogTitle className="dark:text-white">Upload Mapping CSV</DialogTitle>
                <DialogDescription className="dark:text-zinc-400">CSV must have columns: BranchName, To, CC</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Mapping Name</Label>
                  <Input value={mappingName} onChange={(e) => setMappingName(e.target.value)} placeholder="e.g. Branch Mapping Q3" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">CSV File</Label>
                  <Input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} />
                </div>
                {error.length > 0 && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {error.length === 1 ? (
                        error[0]
                      ) : (
                        <ul className="list-disc pl-4 space-y-0.5 max-h-48 overflow-y-auto">
                          {error.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                <Button onClick={handleSaveMapping} className="w-full">Save Mapping</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 bg-zinc-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : mappings.length === 0 ? (
        <Card className="border-zinc-100 shadow-none dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10">
          <CardContent className="p-12 text-center">
            <FileSpreadsheet className="w-12 h-12 mx-auto text-zinc-300 mb-4" />
            <p className="text-zinc-500 font-medium">No mappings yet</p>
            <p className="text-sm text-zinc-400 mt-1">Download the sample CSV or upload your own</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {paginatedMappings.map((m: any, idx) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="group flex items-center justify-between bg-white border border-zinc-200 rounded-xl px-5 py-4 hover:border-zinc-300 hover:shadow-sm transition-all dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 dark:hover:border-white/20 dark:shadow-none"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-50 rounded-lg flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-zinc-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm dark:text-white">{m.mapping_name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => viewEntries(m.id)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => setDeleteConfirm(m.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-xs text-zinc-500">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, mappings.length)} of {mappings.length}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={page === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className={`h-8 w-8 ${page === currentPage ? "bg-[#0A0A0A] text-white" : ""}`}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm dark:bg-[#1A1A1A] dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Delete Mapping?</DialogTitle>
            <DialogDescription className="dark:text-zinc-400">This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 py-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={() => handleDelete(deleteConfirm!)}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-lg dark:bg-[#1A1A1A] dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Mapping Entries</DialogTitle>
            <DialogDescription className="dark:text-zinc-400">Branch-wise recipient details</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>CC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewMapping?.map((entry: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{entry.branch_name}</TableCell>
                    <TableCell className="text-sm">{entry.to_recipients}</TableCell>
                    <TableCell className="text-sm text-zinc-500">{entry.cc_recipients || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
