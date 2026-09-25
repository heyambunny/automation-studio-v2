"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { NotificationBell } from "@/components/layout/notification-bell";
import { AnnouncementBanner } from "@/components/layout/announcement-banner";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUser, clearAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, Moon, Sun } from "lucide-react";
import { useDarkMode } from "@/lib/theme-context";

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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const { dark, toggle } = useDarkMode();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [changePassword, setChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  useEffect(() => {
    const userData = getUser();
    if (!userData) {
      router.push("/login");
    } else {
      setUser(userData);
    }
    const onUserUpdated = () => setUser(getUser());
    window.addEventListener("user-updated", onUserUpdated);
    return () => window.removeEventListener("user-updated", onUserUpdated);
  }, [router]);

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const avatar = AVATARS[user.avatar || "bear-brown"] || AVATARS["bear-brown"];

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] transition-colors relative">
      {/* Dark mode glows */}
      <div className="dark:block hidden fixed top-20 right-10 w-96 h-96 glow-purple rounded-full blur-3xl pointer-events-none z-0" />
      <div className="dark:block hidden fixed bottom-20 left-1/3 w-72 h-72 glow-blue rounded-full blur-3xl pointer-events-none z-0" />
      <Sidebar />
      <div className="ml-56 relative z-10">
        <header className="bg-white dark:bg-[#0A0A0A] border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10 transition-colors">
          <div className="px-6 py-3 flex items-center justify-end gap-2">
            <button
              onClick={toggle}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? <Sun className="w-4 h-4 text-zinc-500" /> : <Moon className="w-4 h-4 text-zinc-500" />}
            </button>
            <NotificationBell />
            <button
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-2.5 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-lg px-2 py-1 transition-colors cursor-pointer"
            >
              <div className="text-right">
                <p className="text-xs font-medium text-[#0A0A0A] dark:text-white">{user.full_name || user.email}</p>
                <p className="text-[10px] text-zinc-400 capitalize">{user.role}</p>
              </div>
              <div className={`w-8 h-8 ${avatar.bg} rounded-full flex items-center justify-center text-lg`}>
                {avatar.emoji}
              </div>
            </button>
          </div>
        </header>
        <AnnouncementBanner />
        {children}
      </div>

      {/* Profile Dialog */}
      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setProfileOpen(false)}>
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center space-y-3">
              <div className={`w-20 h-20 ${avatar.bg} rounded-full flex items-center justify-center text-4xl mx-auto`}>
                {avatar.emoji}
              </div>
              <div>
                <p className="font-semibold text-lg dark:text-white">{user.full_name || "Unnamed"}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{user.email}</p>
              </div>
              <span className="inline-block px-3 py-1 bg-zinc-100 dark:bg-white/10 dark:text-white rounded-full text-xs font-medium capitalize">{user.role}</span>
              <div className="pt-4 border-t border-zinc-100 dark:border-white/10 space-y-2">
                {!changePassword && !confirmLogout && (
                  <button 
                    className="w-full flex items-center justify-center gap-2 border border-zinc-200 dark:border-white/20 rounded-lg py-2 text-sm font-medium text-[#0A0A0A] dark:text-white hover:bg-zinc-50 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={() => setChangePassword(true)}
                  >
                    🔒 Change Password
                  </button>
                )}
                {changePassword && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium dark:text-white">Change Password</p>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-white/20 rounded-lg text-sm bg-white dark:bg-white/5 dark:text-white"
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-white/20 rounded-lg text-sm bg-white dark:bg-white/5 dark:text-white"
                    />
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-white/20 rounded-lg text-sm bg-white dark:bg-white/5 dark:text-white"
                    />
                    {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
                    {passwordSuccess && <p className="text-xs text-emerald-500">{passwordSuccess}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          setPasswordError("");
                          setPasswordSuccess("");
                          if (newPassword !== confirmNewPassword) {
                            setPasswordError("Passwords don't match");
                            return;
                          }
                          if (newPassword.length < 6) {
                            setPasswordError("Password must be at least 6 characters");
                            return;
                          }
                          try {
                            const token = localStorage.getItem("access_token");
                            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/auth/change-password`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${token}`,
                              },
                              body: JSON.stringify({
                                current_password: currentPassword,
                                new_password: newPassword,
                              }),
                            });
                            if (response.ok) {
                              setPasswordSuccess("Password changed!");
                              setChangePassword(false);
                              setCurrentPassword("");
                              setNewPassword("");
                              setConfirmNewPassword("");
                            } else {
                              setPasswordError("Current password is incorrect");
                            }
                          } catch (err) {
                            setPasswordError("Failed to change password");
                          }
                        }}
                        className="flex-1 bg-[#0A0A0A] text-white rounded-lg py-2 text-sm font-medium hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setChangePassword(false); setPasswordError(""); }}
                        className="flex-1 border border-zinc-200 dark:border-white/20 rounded-lg py-2 text-sm font-medium text-[#0A0A0A] dark:text-white hover:bg-zinc-50 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {!confirmLogout ? (
                  <button 
                    className="w-full flex items-center justify-center gap-2 border border-zinc-200 dark:border-white/20 rounded-lg py-2 text-sm font-medium text-[#0A0A0A] dark:text-white hover:bg-zinc-50 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={() => setConfirmLogout(true)}
                  >
                    <LogOut className="w-4 h-4 mr-1" />
                    Sign Out
                  </button>
                ) : (
                  <div>
                    <p className="text-sm font-medium mb-2">Are you sure? 👀</p>
                    <div className="flex gap-2">
                      <button 
                        className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 transition-colors cursor-pointer"
                        onClick={() => { clearAuth(); router.push("/login"); }}
                      >
                        Yes, Logout
                      </button>
                      <button 
                        className="flex-1 border border-zinc-200 dark:border-white/20 rounded-lg py-2 text-sm font-medium text-[#0A0A0A] dark:text-white hover:bg-zinc-50 dark:hover:bg-white/10 transition-colors cursor-pointer"
                        onClick={() => setConfirmLogout(false)}
                      >
                        Wait, No
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
