"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { HardDrive, Loader2, Trash2, TriangleAlert } from "lucide-react";

type Folder = { name: string; bytes: number; files: number; age_days: number; used_by: string[]; reason?: string };
type Preview = {
  retention_days: number;
  total_folders: number;
  total_bytes: number;
  candidates: Folder[];
  candidate_bytes: number;
  protected: Folder[];
};

const mb = (bytes: number) => (bytes / 1_048_576).toFixed(bytes >= 10 * 1_048_576 ? 0 : 1);

export function StorageCleanup() {
  const { showToast } = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setPreview(await api.getCleanupPreview());
    } catch (err: any) {
      showToast(err.message || "Could not read upload storage", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openReview = () => {
    setSelected(new Set(preview?.candidates.map((c) => c.name)));
    setReviewOpen(true);
  };

  const toggle = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  };

  const chosen = preview?.candidates.filter((c) => selected.has(c.name)) ?? [];
  const chosenBytes = chosen.reduce((sum, c) => sum + c.bytes, 0);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const result = await api.runCleanup(chosen.map((c) => c.name));
      showToast(`Deleted ${result.deleted} folder${result.deleted === 1 ? "" : "s"}, freed ${mb(result.freed_bytes)} MB`, "success");
      setReviewOpen(false);
      await load();
    } catch (err: any) {
      showToast(err.message || "Cleanup failed", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Card className="border-zinc-100 shadow-none dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-white/10 flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5 text-zinc-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold dark:text-white">Old campaign uploads</p>
              {loading || !preview ? (
                <p className="text-xs text-zinc-500 mt-1">Checking...</p>
              ) : (
                <>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    {preview.total_folders} upload folder{preview.total_folders === 1 ? "" : "s"} use {mb(preview.total_bytes)} MB. Folders
                    untouched for {preview.retention_days}+ days can be removed; nothing is deleted until you confirm.
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <Button
                      onClick={openReview}
                      disabled={preview.candidates.length === 0}
                      className="bg-[#0A0A0A] text-white hover:bg-zinc-800 border border-white/20"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {preview.candidates.length === 0
                        ? "Nothing to clean up"
                        : `Review ${preview.candidates.length} old folder${preview.candidates.length === 1 ? "" : "s"} (${mb(preview.candidate_bytes)} MB)`}
                    </Button>
                  </div>
                  {preview.protected.length > 0 && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3">
                      {preview.protected.length} older folder{preview.protected.length === 1 ? " is" : "s are"} kept because a schedule or running campaign still needs {preview.protected.length === 1 ? "it" : "them"}.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={reviewOpen} onOpenChange={(open) => { if (!deleting) setReviewOpen(open); }}>
        <DialogContent className="sm:max-w-lg dark:bg-[#1A1A1A] dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 dark:text-white">
              <TriangleAlert className="w-4 h-4 text-amber-500" />Delete old uploads?
            </DialogTitle>
            <DialogDescription className="dark:text-zinc-400">
              These files are permanently deleted. Past campaigns stay in History, but &quot;Retry failed&quot; for them can no longer attach the files.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[45vh] overflow-y-auto space-y-1.5 pr-1">
            {preview?.candidates.map((c) => (
              <label key={c.name} className="flex items-start gap-3 rounded-lg border border-zinc-200 dark:border-white/10 px-3 py-2 cursor-pointer">
                <input type="checkbox" checked={selected.has(c.name)} onChange={() => toggle(c.name)} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium dark:text-white truncate">
                    {c.used_by[0] ?? "Not linked to any campaign"}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {c.files} file{c.files === 1 ? "" : "s"} &middot; {mb(c.bytes)} MB &middot; untouched {c.age_days} days &middot; {c.name}
                  </p>
                </div>
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 dark:border-white/20 dark:text-white dark:hover:bg-white/10" onClick={() => setReviewOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDelete}
              disabled={deleting || chosen.length === 0}
            >
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete {chosen.length} folder{chosen.length === 1 ? "" : "s"} ({mb(chosenBytes)} MB)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
