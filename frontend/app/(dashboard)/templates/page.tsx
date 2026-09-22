"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Eye, Trash2, Mail, Type, FileText } from "lucide-react";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"body" | "subject">("body");
  const [templateName, setTemplateName] = useState("");
  const [templateType, setTemplateType] = useState("body");
  const [content, setContent] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await api.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    await api.createTemplate({ template_name: templateName, template_type: templateType, content });
    setDialogOpen(false);
    setTemplateName("");
    setContent("");
    await loadTemplates();
  };

  const handleDelete = async (id: number) => {
    await api.deleteTemplate(id);
    setDeleteConfirm(null);
    await loadTemplates();
  };

  const filteredTemplates = templates.filter(t => t.template_type === activeTab);
  const bodyCount = templates.filter(t => t.template_type === "body").length;
  const subjectCount = templates.filter(t => t.template_type === "subject").length;

  return (
    <main className="max-w-4xl mx-auto px-8 py-8 dark:text-white">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[#0A0A0A] dark:text-white">Templates</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Reusable email content</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger className="inline-flex items-center gap-2 bg-[#0A0A0A] text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer">
              <Plus className="w-4 h-4" />
              New Template
            </DialogTrigger>
          <DialogContent className="sm:max-w-md dark:bg-[#1A1A1A] dark:border-white/10">
            <DialogHeader>
              <DialogTitle className="dark:text-white">New Template</DialogTitle>
              <DialogDescription className="dark:text-zinc-400">Save reusable email content</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-1.5">
                <Label className="text-xs dark:text-zinc-300">Type</Label>
                <div className="flex gap-1 bg-zinc-100 dark:bg-white/5 rounded-lg p-1">
                  <button
                    onClick={() => setTemplateType("body")}
                    className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${templateType === "body" ? "bg-white dark:bg-white/15 dark:text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400"}`}
                  >
                    Email Body
                  </button>
                  <button
                    onClick={() => setTemplateType("subject")}
                    className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${templateType === "subject" ? "bg-white dark:bg-white/15 dark:text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400"}`}
                  >
                    Subject Line
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs dark:text-zinc-300">Name</Label>
                <Input value={templateName} className="dark:bg-white/5 dark:border-white/10 dark:text-white" onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Standard Report" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs dark:text-zinc-300">Content</Label>
                <Textarea value={content} className="dark:bg-white/5 dark:border-white/10 dark:text-white" onChange={(e) => setContent(e.target.value)} rows={5} placeholder="Use {{BranchName}}, {{ReportType}}, {{Summary}}" />
              </div>
              <Button onClick={handleSave} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Segmented Control */}
      <div className="inline-flex bg-zinc-100 dark:bg-white/5 rounded-lg p-1 mb-6">
        <button
          onClick={() => setActiveTab("body")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === "body" ? "bg-white dark:bg-white/15 shadow-sm dark:text-white" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
        >
          <Mail className="w-3.5 h-3.5" />
          Email Body
          <span className="text-xs text-zinc-400">({bodyCount})</span>
        </button>
        <button
          onClick={() => setActiveTab("subject")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === "subject" ? "bg-white dark:bg-white/15 shadow-sm dark:text-white" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
        >
          <Type className="w-3.5 h-3.5" />
          Subject
          <span className="text-xs text-zinc-400">({subjectCount})</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-zinc-50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card className="border-zinc-100 shadow-none dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10">
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-zinc-300 mb-4" />
            <p className="text-zinc-500">No {activeTab === "body" ? "email body" : "subject"} templates</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTemplates.map((t: any, idx) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="group flex items-center justify-between bg-white border border-zinc-200 rounded-lg px-4 py-3 hover:border-zinc-300 hover:shadow-sm transition-all dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 dark:hover:border-white/20 dark:shadow-none"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate dark:text-white">{t.template_name}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{t.content.slice(0, 80)}...</p>
              </div>
              <div className="flex gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" onClick={() => { setPreviewTemplate(t); setPreviewOpen(true); }}>
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => setDeleteConfirm(t.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-md dark:bg-[#1A1A1A] dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="text-base dark:text-white">{previewTemplate?.template_name}</DialogTitle>
          </DialogHeader>
          <div className="bg-zinc-50 dark:bg-white/5 dark:text-white rounded-lg p-4 text-sm whitespace-pre-wrap max-h-80 overflow-y-auto">
            {previewTemplate?.content}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm dark:bg-[#1A1A1A] dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Delete Template?</DialogTitle>
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
