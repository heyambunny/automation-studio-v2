"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Trash2, Play, Pencil, Search } from "lucide-react";

export default function RecipesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      const data = await api.getRecipes();
      setRecipes(data);
    } catch (err) {
      console.error("Failed to load recipes");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    await api.deleteRecipe(filename);
    setDeleteConfirm(null);
    await loadRecipes();
  };

  const handleExecute = (recipe: any) => {
    // Store recipe config in sessionStorage and redirect to campaign wizard
    sessionStorage.removeItem("campaign_recipe_edit");
    sessionStorage.setItem("campaign_recipe", JSON.stringify(recipe));
    router.push("/campaigns/new");
  };

  const handleEdit = (recipe: any) => {
    sessionStorage.removeItem("campaign_recipe");
    sessionStorage.setItem("campaign_recipe_edit", JSON.stringify(recipe));
    router.push("/campaigns/new");
  };

  const filteredRecipes = recipes.filter(r => 
    (r.saved_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="max-w-5xl mx-auto px-8 py-8 dark:text-white">
      <div className="flex items-center gap-3 mb-8">
        <FileText className="w-6 h-6 text-zinc-400" />
        <div>
          <h2 className="text-2xl font-bold text-[#0A0A0A] dark:text-white">Saved Campaigns</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Reusable campaign recipes</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search campaigns..." className="pl-10" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-14 bg-zinc-50 rounded-xl animate-pulse" />)}
        </div>
      ) : filteredRecipes.length === 0 ? (
        <Card className="border-zinc-100 shadow-none dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10">
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-zinc-300 mb-4" />
            <p className="text-zinc-500 font-medium">No saved campaigns found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRecipes.map((r: any, idx) => (
            <motion.div
              key={r.filename}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="group flex items-center justify-between bg-white border border-zinc-200 rounded-xl px-5 py-4 hover:border-zinc-300 hover:shadow-sm transition-all dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 dark:hover:border-white/20 dark:shadow-none"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-50 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-zinc-500" />
                </div>
                <div>
                  <p className="font-medium text-sm dark:text-white">{r.saved_name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{r.saved_at || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleExecute(r)} title="Execute">
                  <Play className="w-3.5 h-3.5 text-emerald-600" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(r)} title="Edit">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => setDeleteConfirm(r.filename)} title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm dark:bg-[#1A1A1A] dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Delete Recipe?</DialogTitle>
            <DialogDescription className="dark:text-zinc-400">This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 py-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={() => handleDelete(deleteConfirm!)}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
