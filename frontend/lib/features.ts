// Mirrors backend/app/api/v1/feature_access.py's FEATURE_REGISTRY. Dashboard
// and Settings are intentionally not toggleable - Settings hosts the control
// panel, and Dashboard is the landing page everyone lands on after login.
export const FEATURES: { key: string; label: string }[] = [
  { key: "new_campaign", label: "New Campaign" },
  { key: "laboratory", label: "Laboratory" },
  { key: "mappings", label: "Mappings" },
  { key: "history", label: "History" },
  { key: "recipes", label: "Saved Campaigns" },
  { key: "templates", label: "Templates" },
  { key: "schedules", label: "Schedules" },
  { key: "announcements", label: "Announcements" },
  { key: "data_browser", label: "Data Browser" },
  { key: "audit_log", label: "Audit Log" },
  { key: "user_activity", label: "User Activity" },
  { key: "games", label: "Mini Games" },
];

const PATH_FEATURE_MAP: [string, string][] = [
  ["/campaigns/new", "new_campaign"],
  ["/laboratory", "laboratory"],
  ["/mappings", "mappings"],
  ["/history", "history"],
  ["/recipes", "recipes"],
  ["/templates", "templates"],
  ["/schedules", "schedules"],
  ["/announcements", "announcements"],
  ["/data-browser", "data_browser"],
  ["/audit-log", "audit_log"],
  ["/user-activity", "user_activity"],
  ["/games", "games"],
];

export function featureKeyForPath(pathname: string): string | null {
  for (const [prefix, key] of PATH_FEATURE_MAP) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return key;
  }
  return null;
}
