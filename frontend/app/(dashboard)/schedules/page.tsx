"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarClock, Clock, Trash2, CalendarDays, Repeat } from "lucide-react";

const frequencyColors: Record<string, string> = {
  once: "bg-blue-50 text-blue-700 border-blue-200",
  daily: "bg-emerald-50 text-emerald-700 border-emerald-200",
  weekly: "bg-purple-50 text-purple-700 border-purple-200",
  monthly: "bg-amber-50 text-amber-700 border-amber-200",
  custom: "bg-pink-50 text-pink-700 border-pink-200",
};

const frequencyIcons: Record<string, any> = {
  once: CalendarClock,
  daily: CalendarDays,
  weekly: Repeat,
  monthly: CalendarDays,
  custom: Clock,
};

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelConfirm, setCancelConfirm] = useState<number | null>(null);

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      const data = await api.getSchedules();
      setSchedules(data);
    } catch (err) {
      console.error("Failed to load schedules");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: number) => {
    await api.cancelSchedule(id);
    setCancelConfirm(null);
    await loadSchedules();
  };

  return (
    <main className="max-w-5xl mx-auto px-8 py-8 dark:text-white">
      <div className="flex items-center gap-3 mb-8">
        <CalendarClock className="w-6 h-6 text-zinc-400" />
        <div>
          <h2 className="text-2xl font-bold text-[#0A0A0A] dark:text-white">Scheduled Campaigns</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Manage upcoming automated reports</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-zinc-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <Card className="border-zinc-100 shadow-none dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10">
          <CardContent className="p-12 text-center">
            <Clock className="w-12 h-12 mx-auto text-zinc-300 mb-4" />
            <p className="text-zinc-500 font-medium">No scheduled campaigns</p>
            <p className="text-sm text-zinc-400 mt-1">Create one from the New Campaign wizard</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {schedules.map((s: any, idx) => {
            const FreqIcon = frequencyIcons[s.frequency] || Clock;
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group flex items-center justify-between bg-white border border-zinc-200 rounded-xl px-5 py-4 hover:border-zinc-300 hover:shadow-sm transition-all dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 dark:hover:border-white/20 dark:shadow-none"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-50 rounded-lg flex items-center justify-center">
                    <FreqIcon className="w-5 h-5 text-zinc-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm dark:text-white">{s.schedule_name || "Unnamed"}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Next run: {s.next_run || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge className={frequencyColors[s.frequency] || frequencyColors.once}>
                    {s.frequency}
                  </Badge>
                  {s.enabled ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-zinc-400">Disabled</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setCancelConfirm(s.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={cancelConfirm !== null} onOpenChange={() => setCancelConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel Schedule?</DialogTitle>
            <DialogDescription>This will stop all future runs of this campaign.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 py-4">
            <Button variant="outline" className="flex-1" onClick={() => setCancelConfirm(null)}>Keep</Button>
            <Button variant="destructive" className="flex-1" onClick={() => handleCancel(cancelConfirm!)}>Cancel Schedule</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
