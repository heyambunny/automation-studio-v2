"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, UserPlus, UserMinus, UserCog, Mail, FileSpreadsheet, Clock, ChevronLeft, ChevronRight } from "lucide-react";

const ACTION_META: Record<string, { icon: any; label: string; color: string }> = {
  "user.create": { icon: UserPlus, label: "User created", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "user.update": { icon: UserCog, label: "User updated", color: "bg-blue-50 text-blue-700 border-blue-200" },
  "user.delete": { icon: UserMinus, label: "User deleted", color: "bg-red-50 text-red-700 border-red-200" },
  "smtp_profile.delete": { icon: Mail, label: "SMTP profile deleted", color: "bg-red-50 text-red-700 border-red-200" },
  "mapping.delete": { icon: FileSpreadsheet, label: "Mapping deleted", color: "bg-red-50 text-red-700 border-red-200" },
};

const ITEMS_PER_PAGE = 15;

export default function AuditLogPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const userData = getUser();
    if (!userData) {
      router.push("/login");
      return;
    }
    if (userData.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    setUser(userData);
    api.getAuditLogs()
      .then(setLogs)
      .catch(() => console.error("Failed to load audit logs"))
      .finally(() => setLoading(false));
  }, [router]);

  const totalPages = Math.ceil(logs.length / ITEMS_PER_PAGE);
  const paginated = logs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (!user) return null;

  return (
    <main className="max-w-4xl mx-auto px-8 py-8 dark:text-white">
      <div className="flex items-center gap-3 mb-8">
        <ShieldAlert className="w-6 h-6 text-zinc-400" />
        <div>
          <h2 className="text-2xl font-bold text-[#0A0A0A] dark:text-white">Audit Log</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Sensitive admin actions across the app</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-zinc-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <Card className="border-zinc-100 shadow-none dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10">
          <CardContent className="p-12 text-center">
            <ShieldAlert className="w-12 h-12 mx-auto text-zinc-300 mb-4" />
            <p className="text-zinc-500 font-medium">No audit entries yet</p>
            <p className="text-sm text-zinc-400 mt-1">User and credential changes will show up here</p>
          </CardContent>
        </Card>
      ) : (
        <>
        <div className="space-y-2">
          {paginated.map((l: any, idx: number) => {
            const meta = ACTION_META[l.action] || { icon: Clock, label: l.action, color: "bg-zinc-50 text-zinc-600 border-zinc-200" };
            return (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                className="flex items-start gap-3 bg-white border border-zinc-200 rounded-xl px-4 py-3 dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10"
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-50 dark:bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <meta.icon className="w-4 h-4 text-zinc-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={meta.color}>{meta.label}</Badge>
                    <span className="text-xs text-zinc-400">
                      by {l.actor_name || l.actor_email || "Unknown"}
                    </span>
                  </div>
                  {l.details && <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1.5">{l.details}</p>}
                </div>
                <p className="text-[11px] text-zinc-400 shrink-0">
                  {l.created_at ? new Date(l.created_at).toLocaleString() : ""}
                </p>
              </motion.div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-xs text-zinc-500">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, logs.length)} of {logs.length}
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
    </main>
  );
}
