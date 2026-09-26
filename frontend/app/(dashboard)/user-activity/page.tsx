"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Send, XCircle, FileSpreadsheet } from "lucide-react";

const AVATARS: Record<string, { bg: string; emoji: string }> = {
  "bear-brown": { bg: "bg-amber-100", emoji: "🐻" },
  "lion": { bg: "bg-orange-100", emoji: "🦁" },
  "dog": { bg: "bg-yellow-100", emoji: "🐕" },
  "chicken": { bg: "bg-red-100", emoji: "🐔" },
  "meerkat": { bg: "bg-lime-100", emoji: "🦡" },
  "bear-black": { bg: "bg-zinc-200", emoji: "🐻‍❄️" },
  "giraffe": { bg: "bg-amber-50", emoji: "🦒" },
  "dog-brown": { bg: "bg-orange-50", emoji: "🐕‍🦺" },
  "cat": { bg: "bg-purple-100", emoji: "🐱" },
  "rabbit": { bg: "bg-pink-100", emoji: "🐰" },
};

function formatLastLogin(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export default function UserActivityPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
    api.getUserActivity()
      .then(setRows)
      .catch(() => console.error("Failed to load user activity"))
      .finally(() => setLoading(false));
  }, [router]);

  if (!user) return null;

  return (
    <main className="max-w-4xl mx-auto px-8 py-8 dark:text-white">
      <div className="flex items-center gap-3 mb-8">
        <Activity className="w-6 h-6 text-zinc-400" />
        <div>
          <h2 className="text-2xl font-bold text-[#0A0A0A] dark:text-white">User Activity</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Last login and email volume per user</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-zinc-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-zinc-100 shadow-none dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10">
          <CardContent className="p-12 text-center">
            <Activity className="w-12 h-12 mx-auto text-zinc-300 mb-4" />
            <p className="text-zinc-500 font-medium">No users found</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-zinc-100 shadow-none dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Campaigns</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any) => {
                  const avatar = AVATARS[r.avatar || "bear-brown"] || AVATARS["bear-brown"];
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 ${avatar.bg} rounded-full flex items-center justify-center text-base shrink-0`}>
                            {avatar.emoji}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm dark:text-white truncate">{r.full_name || "Unnamed"}</p>
                            <p className="text-xs text-zinc-400 truncate">{r.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="capitalize text-xs">{r.role}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        {formatLastLogin(r.last_login)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-300">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-400" />
                          {r.campaigns_run}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
                          <Send className="w-3.5 h-3.5" />
                          {r.emails_sent}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-red-600">
                          <XCircle className="w-3.5 h-3.5" />
                          {r.emails_failed}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
