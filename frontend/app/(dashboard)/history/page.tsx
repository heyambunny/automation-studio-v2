"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { History as HistoryIcon, ChevronLeft, ChevronRight, Search, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const logStatusColors: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  draft_saved: "bg-amber-50 text-amber-700 border-amber-200",
};

const statusColors: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  queued: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  pending: "bg-zinc-50 text-zinc-600 border-zinc-200",
};

const ITEMS_PER_PAGE = 8;

export default function HistoryPage() {
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsExecution, setLogsExecution] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    loadExecutions();
  }, []);

  const openLogs = async (execution: any) => {
    setLogsExecution(execution);
    setLogsOpen(true);
    setLogsLoading(true);
    try {
      const data = await api.getEmailLogs(execution.id);
      // Failed ones first, so the reasons the user asked about surface immediately
      const sorted = [...data].sort((a, b) => (a.status === "failed" ? -1 : 0) - (b.status === "failed" ? -1 : 0));
      setLogs(sorted);
    } catch (err) {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const loadExecutions = async () => {
    try {
      const data = await api.getExecutions();
      setExecutions(data);
    } catch (err) {
      console.error("Failed to load executions");
    } finally {
      setLoading(false);
    }
  };

  const filtered = executions.filter((e) => {
    const matchesSearch = !search || (e.campaign_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  return (
    <main className="max-w-5xl mx-auto px-8 py-8 dark:text-white">
      <div className="flex items-center gap-3 mb-8">
        <HistoryIcon className="w-6 h-6 text-zinc-400" />
        <div>
          <h2 className="text-2xl font-bold text-[#0A0A0A] dark:text-white">Campaign History</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Track all your campaign executions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns..."
            className="pl-10"
          />
        </div>
        <div className="flex gap-1 bg-zinc-100 dark:bg-white/5 rounded-lg p-1">
          {["all", "completed", "failed", "in_progress", "queued"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                statusFilter === status ? "bg-white dark:bg-white/15 shadow-sm dark:text-white" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {status === "all" ? "All" : status.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-zinc-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-zinc-100 shadow-none dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10">
          <CardContent className="p-12 text-center">
            <HistoryIcon className="w-12 h-12 mx-auto text-zinc-300 mb-4" />
            <p className="text-zinc-500 font-medium">No campaigns found</p>
            <p className="text-sm text-zinc-400 mt-1">Try adjusting your filters</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {paginated.map((e: any, idx) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => openLogs(e)}
                className="flex items-center justify-between bg-white border border-zinc-200 rounded-xl px-5 py-4 hover:border-zinc-300 hover:shadow-sm transition-all cursor-pointer dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 dark:hover:border-white/20 dark:shadow-none"
              >
                <div className="flex-1">
                  <p className="font-medium text-sm dark:text-white">{e.campaign_name || "Unnamed"}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{e.created_at || "—"}</p>
                </div>
                <Badge className={statusColors[e.status] || statusColors.pending}>
                  {e.status || "pending"}
                </Badge>
                <div className="w-24 text-right">
                  <p className="text-sm font-medium text-emerald-600">{e.sent_count}</p>
                  <p className="text-xs text-zinc-400">Sent</p>
                </div>
                <div className="w-24 text-right ml-4">
                  <p className="text-sm font-medium text-red-600">{e.failed_count}</p>
                  <p className="text-xs text-zinc-400">Failed</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-xs text-zinc-500">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
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
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Per-branch email log details */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{logsExecution?.campaign_name || "Campaign"}</DialogTitle>
            <DialogDescription>
              {logsExecution?.sent_count ?? 0} sent · {logsExecution?.failed_count ?? 0} failed · {logsExecution?.created_at || ""}
            </DialogDescription>
          </DialogHeader>
          {logsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-8">No per-email details recorded for this campaign.</p>
          ) : (
            <div className="space-y-2 py-2">
              {logs.map((l: any) => (
                <div
                  key={l.id}
                  className={`rounded-lg border px-4 py-3 ${l.status === "failed" ? "border-red-200 bg-red-50/50 dark:bg-red-500/5 dark:border-red-900/40" : "border-zinc-200 dark:border-white/10"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {l.status === "sent" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : l.status === "failed" ? (
                        <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                      ) : null}
                      <p className="font-medium text-sm truncate dark:text-white">{l.branch_name || "Unnamed branch"}</p>
                    </div>
                    <Badge className={logStatusColors[l.status] || "bg-zinc-50 text-zinc-600 border-zinc-200"}>
                      {(l.status || "").replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                    To: {l.recipient_to || "—"}{l.recipient_cc ? ` · CC: ${l.recipient_cc}` : ""}
                  </p>
                  {l.status === "failed" && l.error_message && (
                    <p className="text-xs text-red-600 mt-1.5 bg-red-100/60 dark:bg-red-500/10 rounded px-2 py-1">
                      {l.error_message}
                    </p>
                  )}
                  {l.sent_at && (
                    <p className="text-[11px] text-zinc-400 mt-1">{l.sent_at}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
