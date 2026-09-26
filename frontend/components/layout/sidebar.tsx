"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { LayoutDashboard, Settings, FileSpreadsheet, PlusCircle, History, FileText, Clock, Database, FolderOpen, Gamepad2, Megaphone, ShieldAlert, FlaskConical, Activity } from "lucide-react";

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

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/campaigns/new", label: "New Campaign", icon: PlusCircle },
  { href: "/laboratory", label: "Laboratory", icon: FlaskConical },
  { href: "/mappings", label: "Mappings", icon: FileSpreadsheet },
  { href: "/history", label: "History", icon: History },
  { href: "/recipes", label: "Saved Campaigns", icon: FolderOpen },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/schedules", label: "Schedules", icon: Clock },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/data-browser", label: "Data Browser", icon: Database, adminOnly: true },
  { href: "/audit-log", label: "Audit Log", icon: ShieldAlert, adminOnly: true },
  { href: "/user-activity", label: "User Activity", icon: Activity, adminOnly: true },
  { href: "/games", label: "Mini Games", icon: Gamepad2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
  const isAdmin = user.role === "admin";
  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin);
  const theme = useTheme();

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-white dark:bg-[#0A0A0A] border-r border-zinc-100 dark:border-zinc-800 flex flex-col transition-colors">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#0A0A0A] rounded-lg flex items-center justify-center">
            <span className="text-sm">{theme.emoji}</span>
          </div>
          <span className="font-semibold text-sm text-[#0A0A0A] dark:text-white">Studio</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors border",
                isActive
                  ? "bg-zinc-100 text-[#0A0A0A] font-medium border-transparent dark:bg-transparent dark:text-white dark:border-white/30"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border-transparent dark:text-zinc-400 dark:hover:text-white dark:hover:bg-transparent dark:hover:border-white/10"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-zinc-100 dark:border-zinc-800">
        {(() => {
          const userData = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
          const avatar = AVATARS[userData.avatar || "bear-brown"] || AVATARS["bear-brown"];
          return (
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 ${avatar.bg} rounded-full flex items-center justify-center text-lg`}>
                {avatar.emoji}
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-[#0A0A0A] dark:text-white">{userData.full_name || "User"}</p>
                <p className="text-[10px] text-zinc-400 capitalize">{userData.role}</p>
              </div>
            </div>
          );
        })()}
      </div>
      {/* Footer */}
      <div className="px-4 py-4 border-t border-zinc-100 dark:border-zinc-800">
        <p className="text-xs text-zinc-400 text-center">
          Made with <span className="text-red-500 animate-pulse">❤️</span> by <span className="font-semibold text-zinc-600 dark:text-zinc-300">Bunny 🐰</span>
        </p>
      </div>
    </aside>
  );
}
