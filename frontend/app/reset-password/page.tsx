"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle2, Lock, TriangleAlert, Zap } from "lucide-react";

const MIN_LENGTH = 8;

type Stage = "checking" | "invalid" | "form" | "done";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // The token arrives in the URL fragment (#token=...), which browsers never
    // send to the server - read it client-side, then strip it from the address
    // bar so it doesn't linger in history.
    const t = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    setToken(t);
    if (t) window.history.replaceState(null, "", window.location.pathname);
    if (!t) {
      setStage("invalid");
      return;
    }
    api.checkResetToken(t)
      .then((r) => setStage(r.valid ? "form" : "invalid"))
      .catch(() => setStage("invalid"));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setStage("done");
    } catch (err) {
      setError(err instanceof ApiError && err.message ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-white">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-[#0F172A]">Automation Studio</span>
        </div>

        {stage === "checking" && <p className="text-sm text-slate-500">Checking your reset link...</p>}

        {stage === "invalid" && (
          <div>
            <div className="w-11 h-11 rounded-full bg-amber-50 flex items-center justify-center mb-5">
              <TriangleAlert className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Link expired or invalid</h2>
            <p className="text-sm text-slate-500 mb-8">
              Reset links expire after 30 minutes and work only once. Request a new one to continue.
            </p>
            <Link href="/forgot-password">
              <Button className="w-full h-11 rounded-lg bg-black text-white hover:bg-zinc-800">Request a new link</Button>
            </Link>
          </div>
        )}

        {stage === "done" && (
          <div>
            <div className="w-11 h-11 rounded-full bg-emerald-50 flex items-center justify-center mb-5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Password updated</h2>
            <p className="text-sm text-slate-500 mb-8">You can now sign in with your new password.</p>
            <Link href="/login">
              <Button className="w-full h-11 rounded-lg bg-black text-white hover:bg-zinc-800">Go to sign in</Button>
            </Link>
          </div>
        )}

        {stage === "form" && (
          <>
            <h2 className="text-2xl font-bold text-[#0F172A] mb-1">Set a new password</h2>
            <p className="text-sm text-slate-500 mb-8">Use at least {MIN_LENGTH} characters.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 h-11 rounded-lg border-slate-200 focus:border-slate-400"
                    autoComplete="new-password"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Confirm new password</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 h-11 rounded-lg border-slate-200 focus:border-slate-400"
                    autoComplete="new-password"
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
                {loading ? "Updating..." : "Update password"}
              </Button>
            </form>
          </>
        )}

        {stage !== "done" && (
          <Link href="/login" className="mt-8 flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>
        )}
      </motion.div>
    </div>
  );
}
