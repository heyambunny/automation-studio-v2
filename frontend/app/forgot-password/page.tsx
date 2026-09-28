"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, MailCheck, Zap } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
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

        {sent ? (
          <div>
            <div className="w-11 h-11 rounded-full bg-emerald-50 flex items-center justify-center mb-5">
              <MailCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Check your email</h2>
            <p className="text-sm text-slate-500 mb-8">
              If an account exists for <span className="font-medium text-slate-700">{email}</span>, we&apos;ve sent a link
              to reset your password. It expires in 30 minutes. Don&apos;t see it? Check your spam folder.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => { setSent(false); setError(""); }}
            >
              Use a different email
            </Button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-[#0F172A] mb-1">Forgot password?</h2>
            <p className="text-sm text-slate-500 mb-8">Enter your account email and we&apos;ll send you a link to reset it.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="pl-10 h-11 rounded-lg border-slate-200 focus:border-slate-400"
                    required
                    autoFocus
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
                {loading ? "Sending..." : "Send reset link"}
              </Button>
            </form>
          </>
        )}

        <Link href="/login" className="mt-8 flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Back to sign in
        </Link>
      </motion.div>
    </div>
  );
}
