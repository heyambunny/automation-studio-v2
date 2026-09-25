"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api";

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const { count } = await api.getUnreadNotificationCount();
      setUnreadCount(count);
    } catch {
      // notifications are non-critical - fail silently rather than
      // interrupting the rest of the app with a polling error
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 30000);
    return () => clearInterval(interval);
  }, [refreshCount]);

  const handleToggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      try {
        const data = await api.getNotifications();
        setNotifications(data);
        setLoaded(true);
      } catch {
        // ignore
      }
    }
  };

  const handleClickItem = async (n: any) => {
    if (!n.is_read) {
      try {
        await api.markNotificationRead(n.id);
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // ignore
      }
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="relative p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
        title="Notifications"
      >
        <Bell className="w-4 h-4 text-zinc-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-white/10 rounded-xl shadow-xl z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-white/10 sticky top-0 bg-white dark:bg-[#1A1A1A]">
              <p className="text-sm font-semibold dark:text-white">Notifications</p>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-white cursor-pointer">
                  Mark all as read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-8">No notifications yet</p>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-white/10">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClickItem(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors cursor-pointer ${!n.is_read ? "bg-zinc-50/60 dark:bg-white/[0.03]" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      {n.type === "campaign_failed" ? (
                        <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs ${!n.is_read ? "font-semibold" : "font-medium"} dark:text-white truncate`}>{n.title}</p>
                        {n.message && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{n.message}</p>}
                        <p className="text-[10px] text-zinc-400 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                      {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
