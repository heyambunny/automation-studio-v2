"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";

const BANNER_PREVIEW_LENGTH = 160;

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only check right after an actual login (set by the login page), not on
    // every client-side navigation within an already-open session - that's
    // what keeps this to "the next 3 times a user logs in" rather than
    // every page view.
    if (sessionStorage.getItem("check_announcement_banner") !== "1") return;
    sessionStorage.removeItem("check_announcement_banner");
    api
      .getAnnouncementBanner()
      .then((res) => {
        if (res.announcement) setAnnouncement(res.announcement);
      })
      .catch(() => {
        // non-critical - just skip the banner
      });
  }, []);

  if (!announcement || dismissed) return null;

  const content: string = announcement.content || "";
  const preview = content.length > BANNER_PREVIEW_LENGTH
    ? content.slice(0, BANNER_PREVIEW_LENGTH).trimEnd() + "…"
    : content;

  return (
    <div className="mx-6 mt-4 rounded-2xl bg-gradient-to-r from-[#0A0A0A] to-[#232323] border border-white/10 px-6 py-5 relative text-white overflow-hidden">
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors cursor-pointer"
        title="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3 relative z-10">
        <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <p className="text-xs font-semibold text-blue-300 uppercase tracking-wide mb-1">What&apos;s new</p>
          <p className="font-semibold text-sm mb-1.5">{announcement.title}</p>
          <p className="text-sm text-zinc-300 whitespace-pre-line">{preview}</p>
          <Link
            href="/announcements"
            className="inline-block text-xs text-blue-300 hover:text-blue-200 mt-2 underline underline-offset-2"
          >
            {content.length > BANNER_PREVIEW_LENGTH ? "Read more" : "View all announcements"}
          </Link>
        </div>
      </div>
    </div>
  );
}
