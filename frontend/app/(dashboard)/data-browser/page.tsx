"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Database, Table as TableIcon, Search, ChevronRight, Loader2, ChevronLeft } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const ROWS_PER_PAGE = 20;

export default function DataBrowserPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [tableData, setTableData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
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
    loadTables();
  }, [router]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTable]);

  const loadTables = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(`${API_BASE_URL}/data-browser/tables`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTables(data.tables || []);
      }
    } catch (err) {
      console.error("Failed to load tables");
    }
  };

  const loadTableData = async (tableName: string) => {
    setLoading(true);
    setSelectedTable(tableName);
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(`${API_BASE_URL}/data-browser/table/${tableName}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTableData(data.rows || []);
      }
    } catch (err) {
      console.error("Failed to load table data");
    } finally {
      setLoading(false);
    }
  };

  const filteredTables = tables.filter(t => t.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(tableData.length / ROWS_PER_PAGE);
  const paginatedData = tableData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  if (!user) return null;

  return (
    <main className="max-w-6xl mx-auto px-8 py-8 dark:text-white">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-[#0A0A0A] rounded-xl flex items-center justify-center">
          <Database className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#0A0A0A] dark:text-white">Data Browser</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Admin access — {tables.length} tables</p>
        </div>
      </div>

      {/* Search + Table Chips */}
      <div className="mb-6">
        <div className="relative max-w-xs mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tables..." className="pl-10" />
        </div>
        <div className="flex flex-wrap gap-2">
          {filteredTables.map((table, idx) => (
            <motion.button
              key={table}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
              onClick={() => loadTableData(table)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all cursor-pointer ${
                selectedTable === table
                  ? "bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] border-[#0A0A0A] dark:border-white"
                  : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400 hover:shadow-sm dark:bg-white/5 dark:text-zinc-300 dark:border-white/10 dark:hover:border-white/20"
              }`}
            >
              <TableIcon className={`w-3.5 h-3.5 ${selectedTable === table ? "text-white" : "text-zinc-400"}`} />
              {table}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Table Data */}
      {selectedTable && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-3">
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            <h3 className="text-sm font-semibold dark:text-white">{selectedTable}</h3>
            <span className="text-xs text-zinc-400">({tableData.length} rows)</span>
          </div>

          <Card className="border-zinc-100 shadow-sm dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center flex items-center justify-center gap-2 text-zinc-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              ) : tableData.length === 0 ? (
                <div className="p-12 text-center text-zinc-400">No data in this table</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-100">
                          {Object.keys(tableData[0]).map((key) => (
                            <th key={key} className="text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 px-4 py-3 whitespace-nowrap">{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.map((row: any, idx: number) => (
                          <tr key={idx} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors">
                            {Object.values(row).map((value: any, i: number) => (
                              <td key={i} className="text-xs text-zinc-700 dark:text-zinc-300 px-4 py-2.5 whitespace-nowrap">
                                {typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100">
                      <p className="text-xs text-zinc-500">
                        Showing {((currentPage - 1) * ROWS_PER_PAGE) + 1}–{Math.min(currentPage * ROWS_PER_PAGE, tableData.length)} of {tableData.length}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </Button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                          let pageNum = i + 1;
                          if (totalPages > 5 && currentPage > 3) {
                            pageNum = currentPage - 3 + i + 1;
                          }
                          if (pageNum <= totalPages) {
                            return (
                              <Button
                                key={pageNum}
                                variant={pageNum === currentPage ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(pageNum)}
                                className={`h-7 w-7 text-xs ${pageNum === currentPage ? "bg-[#0A0A0A] text-white" : ""}`}
                              >
                                {pageNum}
                              </Button>
                            );
                          }
                          return null;
                        })}
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </main>
  );
}
