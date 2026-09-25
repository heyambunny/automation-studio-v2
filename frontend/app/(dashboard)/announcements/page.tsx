"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Megaphone, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

const CONTENT_PREVIEW_LENGTH = 220;

export default function AnnouncementsPage() {
  const { showToast } = useToast();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    setIsAdmin(user.role === "admin");
    load();
  }, []);

  const load = async () => {
    try {
      setAnnouncements(await api.getAnnouncements());
    } catch (err) {
      console.error("Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) {
      showToast("Title and content are required", "error");
      return;
    }
    try {
      await api.createAnnouncement({ title, content });
      setDialogOpen(false);
      setTitle("");
      setContent("");
      await load();
      showToast("Announcement published", "success");
    } catch (err: any) {
      showToast(err?.message || "Failed to publish announcement", "error");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteAnnouncement(id);
      setDeleteConfirm(null);
      await load();
      showToast("Announcement deleted", "success");
    } catch (err: any) {
      showToast(err?.message || "Failed to delete announcement", "error");
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-8 py-8 dark:text-white">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Megaphone className="w-6 h-6 text-zinc-400" />
          <div>
            <h2 className="text-2xl font-bold text-[#0A0A0A] dark:text-white">Announcements</h2>
            <p className="text-sm text-zinc-500 mt-0.5">What&apos;s new in Automation Studio</p>
          </div>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger className="inline-flex items-center gap-2 bg-[#0A0A0A] text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer">
              <Plus className="w-4 h-4" />
              New Announcement
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg dark:bg-[#1A1A1A] dark:border-white/10">
              <DialogHeader>
                <DialogTitle className="dark:text-white">New Announcement</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New: Failure notifications" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Content</Label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={5}
                    placeholder="What's new for users..."
                  />
                </div>
                <Button onClick={handleCreate} className="w-full">Publish</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-zinc-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <Card className="border-zinc-100 shadow-none dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10">
          <CardContent className="p-12 text-center">
            <Megaphone className="w-12 h-12 mx-auto text-zinc-300 mb-4" />
            <p className="text-zinc-500 font-medium">No announcements yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((a: any, idx: number) => {
            const isLong = (a.content || "").length > CONTENT_PREVIEW_LENGTH;
            const isExpanded = expandedIds.has(a.id);
            const displayText = isLong && !isExpanded
              ? a.content.slice(0, CONTENT_PREVIEW_LENGTH).trimEnd() + "…"
              : a.content;
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="group bg-white border border-zinc-200 rounded-2xl p-6 dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm dark:text-white">{a.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString() : ""}
                      {a.created_by_name ? ` · ${a.created_by_name}` : ""}
                    </p>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={() => setDeleteConfirm(a.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-3 whitespace-pre-line">{displayText}</p>
                {isLong && (
                  <button
                    onClick={() => toggleExpand(a.id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-zinc-900 dark:text-white mt-2 hover:underline cursor-pointer"
                  >
                    {isExpanded ? (
                      <>Show less <ChevronUp className="w-3 h-3" /></>
                    ) : (
                      <>Read more <ChevronDown className="w-3 h-3" /></>
                    )}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm dark:bg-[#1A1A1A] dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Delete Announcement?</DialogTitle>
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
