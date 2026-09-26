const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      if (Array.isArray(body?.detail?.errors)) message = body.detail.errors.join("; ");
      else if (typeof body?.detail === "string") message = body.detail;
    } catch {
      // response wasn't JSON - stick with statusText
    }
    throw new ApiError(message, response.status);
  }
  return response.json();
}

export const api = {
  login: (email: string, password: string) =>
    apiRequest<{ access_token: string; refresh_token: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  getSMTPProfiles: () => apiRequest<any[]>("/settings/smtp-profiles"),
  createSMTPProfile: (data: any) =>
    apiRequest("/settings/smtp-profiles", { method: "POST", body: JSON.stringify(data) }),
  updateSMTPProfile: (id: number, data: any) => apiRequest(`/settings/smtp-profiles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSMTPProfile: (id: number) =>
    apiRequest(`/settings/smtp-profiles/${id}`, { method: "DELETE" }),
  getMappings: () => apiRequest<any[]>("/mappings/"),
  getMappingEntries: (id: number) => apiRequest<any[]>(`/mappings/${id}/entries`),
  createMapping: (data: any) =>
    apiRequest("/mappings/", { method: "POST", body: JSON.stringify(data) }),
  deleteMapping: (id: number) =>
    apiRequest(`/mappings/${id}`, { method: "DELETE" }),
  getTemplates: (type?: string) =>
    apiRequest<any[]>(`/templates/${type ? `?template_type=${type}` : ""}`),
  createTemplate: (data: any) =>
    apiRequest("/templates/", { method: "POST", body: JSON.stringify(data) }),
  deleteTemplate: (id: number) => apiRequest(`/templates/${id}`, { method: "DELETE" }),
  getExecutions: () => apiRequest<any[]>("/executions/"),
  getEmailLogs: (id: number) => apiRequest<any[]>(`/executions/${id}/logs`),
  retryExecution: (id: number) => apiRequest<{ message: string; count: number; sent?: number; failed?: number }>(`/executions/${id}/retry`, { method: "POST" }),
  getSchedules: () => apiRequest<any[]>("/schedules/"),
  cancelSchedule: (id: number) => apiRequest(`/schedules/${id}`, { method: "DELETE" }),
  createSchedule: (data: any) => apiRequest<any>("/schedules/", { method: "POST", body: JSON.stringify(data) }),
  updateSchedule: (id: number, data: any) => apiRequest<any>(`/schedules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  getRecipes: () => apiRequest<any[]>("/campaigns/recipes"),
  deleteRecipe: (filename: string) => apiRequest(`/campaigns/recipes/${filename}`, { method: "DELETE" }),
  saveRecipe: (data: any) => apiRequest("/campaigns/recipes", { method: "POST", body: JSON.stringify(data) }),
  updateRecipe: (filename: string, data: any) => apiRequest(`/campaigns/recipes/${encodeURIComponent(filename)}`, { method: "PUT", body: JSON.stringify(data) }),
  executeCampaign: (data: any) => apiRequest("/campaigns/execute-now", { method: "POST", body: JSON.stringify(data) }),
  previewSummary: async (file: File, sheetName: string, summaryFormat: string = "table") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("sheet_name", sheetName || "Summary");
    fd.append("summary_format", summaryFormat);
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/campaigns/preview-summary`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!response.ok) throw new ApiError(response.statusText, response.status);
    return response.json() as Promise<{ html: string }>;
  },
  getDashboardStats: () => apiRequest<any>("/dashboard/stats"),
  submitGameScore: (data: any) => apiRequest("/games/scores", { method: "POST", body: JSON.stringify(data) }),
  getLeaderboard: (game: string) => apiRequest<any[]>(`/games/leaderboard/${game}`),
  getUserBest: (game: string) => apiRequest<any>(`/games/user-best/${game}`),
  testSMTP: (data: any) => apiRequest<{ success: boolean; message?: string }>("/settings/test-smtp", { method: "POST", body: JSON.stringify(data) }),
  getUsers: () => apiRequest<any[]>("/users/"),
  getUserActivity: () => apiRequest<any[]>("/users/activity"),
  createUser: (data: any) => apiRequest("/users/", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: number, data: any) => apiRequest(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUser: (id: number) => apiRequest(`/users/${id}`, { method: "DELETE" }),
  getMyProfile: () => apiRequest<any>("/users/me"),
  updateMyProfile: (data: any) => apiRequest<any>("/users/me", { method: "PUT", body: JSON.stringify(data) }),
  getNotifications: () => apiRequest<any[]>("/notifications/"),
  getUnreadNotificationCount: () => apiRequest<{ count: number }>("/notifications/unread-count"),
  markNotificationRead: (id: number) => apiRequest(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () => apiRequest("/notifications/read-all", { method: "POST" }),
  getUserSettings: () => apiRequest<any>("/settings/settings"),
  updateUserSettings: (data: any) => apiRequest("/settings/settings", { method: "PUT", body: JSON.stringify(data) }),
  getAuditLogs: () => apiRequest<any[]>("/audit-logs/"),
  getAnnouncements: () => apiRequest<any[]>("/announcements/"),
  getAnnouncementBanner: () => apiRequest<{ announcement: any; view_number?: number; view_limit?: number }>("/announcements/banner"),
  createAnnouncement: (data: any) => apiRequest<any>("/announcements/", { method: "POST", body: JSON.stringify(data) }),
  deleteAnnouncement: (id: number) => apiRequest(`/announcements/${id}`, { method: "DELETE" }),
  analyzeSplitFile: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/laboratory/analyze`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!response.ok) throw new ApiError(response.statusText, response.status);
    return response.json() as Promise<{
      sheet_names: string[] | null;
      sheets_analyzed: number;
      row_count: number;
      columns: { name: string; unique_count: number; sample_values: string[]; recommended: boolean }[];
    }>;
  },
  splitFile: async (file: File, columnName: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("column_name", columnName);
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/laboratory/split`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!response.ok) {
      let message = response.statusText;
      try {
        const body = await response.json();
        if (typeof body?.detail === "string") message = body.detail;
      } catch {
        // not JSON - stick with statusText
      }
      throw new ApiError(message, response.status);
    }
    return response.blob();
  },
};
