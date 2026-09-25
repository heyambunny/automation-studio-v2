"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { saveAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Mail, Lock, FileSpreadsheet, Send, ChartBar, Zap } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api.login(email, password);
      saveAuth(result);
      sessionStorage.setItem("check_announcement_banner", "1");
      router.push("/dashboard");
    } catch (err) {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: FileSpreadsheet, label: "Upload Excel & CSV", color: "bg-zinc-800 text-zinc-300" },
    { icon: Send, label: "Auto Email Dispatch", color: "bg-zinc-800 text-zinc-300" },
    { icon: ChartBar, label: "Real-time Analytics", color: "bg-zinc-800 text-zinc-300" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Black */}
      <div className="hidden lg:flex flex-1 bg-[#0A0A0A] items-center justify-center px-16 relative overflow-hidden">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }} />

        {/* Glow */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-zinc-800/20 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-16">
              <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-black" />
              </div>
              <span className="font-semibold text-white">Automation Studio</span>
            </div>

            <h1 className="text-4xl font-bold text-white leading-tight mb-6">
              Automate your
              <br />
              email reporting
            </h1>
            <p className="text-zinc-400 text-lg mb-12">
              Eliminate repetitive Email work. Send personalized reports to every multiple users in seconds.
            </p>

            <div className="space-y-4">
              {features.map((feature, idx) => (
                <motion.div
                  key={feature.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + idx * 0.15 }}
                  className="flex items-center gap-4 bg-[#141414] border border-[#1F1F1F] rounded-xl px-5 py-4"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${feature.color}`}>
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <span className="font-medium text-sm text-zinc-200">{feature.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center px-6 bg-white">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="w-full max-w-sm"
        >
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">Automation Studio</span>
          </div>

          <h2 className="text-2xl font-bold text-[#0F172A] mb-1">Sign in</h2>
          <p className="text-sm text-slate-500 mb-8">Enter your credentials to continue</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@company.com"
                  className="pl-10 h-11 rounded-lg border-slate-200 focus:border-slate-400"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 h-11 rounded-lg border-slate-200 focus:border-slate-400"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-11 rounded-lg bg-black text-white hover:bg-zinc-800"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <p className="text-xs text-slate-400 text-center mt-8">
            Internal tool · Secure access
          </p>
        </motion.div>
      </div>
    </div>
  );
}
