"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, FileSpreadsheet, CheckCircle2, XCircle, Activity, Send, TrendingUp, Zap } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";



function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const duration = 1500;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      setCount(Math.floor(progress * value));
      if (progress === 1) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{count}{suffix}</span>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);

  const statCards = stats ? [
    { label: "Total Campaigns", value: stats.total_campaigns, icon: FileSpreadsheet },
    { label: "Completed", value: stats.completed, icon: CheckCircle2 },
    { label: "Failed", value: stats.failed, icon: XCircle },
    { label: "Active Now", value: stats.in_progress, icon: Activity },
  ] : [
    { label: "Total Campaigns", value: 0, icon: FileSpreadsheet },
    { label: "Completed", value: 0, icon: CheckCircle2 },
    { label: "Failed", value: 0, icon: XCircle },
    { label: "Active Now", value: 0, icon: Activity },
  ];

  const emailData = stats?.email_activity || [
    { day: "Mon", sent: 0 },
    { day: "Tue", sent: 0 },
    { day: "Wed", sent: 0 },
    { day: "Thu", sent: 0 },
    { day: "Fri", sent: 0 },
    { day: "Sat", sent: 0 },
    { day: "Sun", sent: 0 },
  ];

  useEffect(() => {
    api.getDashboardStats().then(setStats).catch(console.error);
  }, []);

  

  return (
    <main className="max-w-6xl mx-auto px-8 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#0A0A0A] dark:text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Your automation at a glance</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => router.push("/campaigns/new")}
          className="flex items-center gap-2 bg-[#0A0A0A] text-white text-sm font-semibold px-6 py-3 rounded-xl border border-white/20 hover:border-white/40 hover:bg-zinc-800 transition-all cursor-pointer"
        >
          <Zap className="w-4 h-4" fill="currentColor" />
          New Campaign
        </motion.button>
      </motion.div>

      {/* Hero Stat */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative overflow-hidden bg-[#0A0A0A] dark:bg-white/5 dark:backdrop-blur-xl dark:border dark:border-white/10 rounded-2xl p-8 mb-6"
      >
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }} />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-zinc-400 dark:text-zinc-400 text-sm mb-2">Total Emails Sent</p>
            <p className="text-5xl font-bold text-white tracking-tight">
              <AnimatedCounter value={stats?.sent_emails || 0} />
            </p>
            <p className="text-emerald-400 text-sm mt-3 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              +18% from last month
            </p>
          </div>
          <div className="flex gap-8">
            {[
              { value: stats?.total_campaigns || 0, label: "Campaigns" },
              { value: stats?.schedules || 0, label: "Scheduled" },
              { value: stats?.success_rate || 0, label: "Success %", suffix: "%" },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-3xl font-bold text-white">
                  <AnimatedCounter value={item.value} suffix={item.suffix || ""} />
                </p>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {statCards.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + idx * 0.05 }}
            whileHover={{ y: -4 }}
            className="group cursor-pointer"
          >
            <Card className="border-zinc-100 shadow-sm group-hover:shadow-md group-hover:border-zinc-300 transition-all overflow-hidden dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 dark:shadow-none dark:group-hover:bg-white/8 dark:group-hover:border-white/20">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <motion.div
                    whileHover={{ rotate: 8, scale: 1.08 }}
                    className="w-12 h-12 rounded-xl bg-zinc-50 dark:bg-black/50 flex items-center justify-center group-hover:bg-zinc-100 dark:group-hover:bg-black/70 transition-colors"
                  >
                    <stat.icon className="w-6 h-6 text-zinc-700 dark:text-white" strokeWidth={1.5} />
                  </motion.div>
                  <ArrowRight className="w-4 h-4 text-zinc-300 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-2xl font-bold text-[#0A0A0A] dark:text-white tracking-tight">
                  <AnimatedCounter value={stat.value} />
                </p>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1">{stat.label}</p>
                <div className="mt-4 h-0.5 bg-zinc-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ delay: 0.6 + idx * 0.1, duration: 0.8 }}
                    className="h-full bg-[#0A0A0A] dark:bg-white/30 rounded-full"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="border-zinc-100 shadow-sm mb-6 dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 dark:shadow-none">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-semibold dark:text-white">Email Activity</h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-400 mt-0.5">Emails sent per day</p>
              </div>
              <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-white/10 dark:text-zinc-300 px-3 py-1 rounded-full">Last 7 days</span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={emailData}>
                <defs>
                  <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0A0A0A" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#0A0A0A" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'currentColor' }} stroke="transparent" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} stroke="transparent" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', padding: '12px', background: 'rgba(10,10,10,0.9)', color: 'white' }} />
                <Area type="monotone" dataKey="sent" stroke="#0A0A0A" strokeWidth={2} fill="url(#gradient)" name="Emails" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Links */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "New Campaign", icon: Send, href: "/campaigns/new" },
          { label: "History", icon: TrendingUp, href: "/history" },
          { label: "Settings", icon: FileSpreadsheet, href: "/settings" },
        ].map((link, idx) => (
          <motion.button
            key={link.href}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push(link.href)}
            className="flex items-center gap-3 bg-white border border-zinc-200 rounded-xl px-5 py-4 hover:border-zinc-400 hover:shadow-lg cursor-pointer transition-all dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 dark:hover:border-white/20 dark:shadow-none dark:hover:bg-white/8"
          >
            <link.icon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span className="text-sm font-medium text-[#0A0A0A] dark:text-white">{link.label}</span>
            <ArrowRight className="w-4 h-4 text-zinc-300 dark:text-zinc-500 ml-auto" />
          </motion.button>
        ))}
      </div>
    </main>
  );
}
