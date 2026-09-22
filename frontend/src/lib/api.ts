const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("access_token");
  
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    throw new ApiError(response.statusText, response.status);
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
    apiRequest("/settings/smtp-profiles", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteSMTPProfile: (id: number) =>
    apiRequest(`/settings/smtp-profiles/${id}`, { method: "DELETE" }),
  
  getMappings: () => apiRequest<any[]>("/mappings/"),
  createMapping: (data: any) =>
    apiRequest("/mappings/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteMapping: (id: number) =>
    apiRequest(`/mappings/${id}`, { method: "DELETE" }),
  
  getTemplates: (type?: string) =>
    apiRequest<any[]>(`/templates/${type ? `?template_type=${type}` : ""}`),
  createTemplate: (data: any) =>
    apiRequest("/templates/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  
  getExecutions: () => apiRequest<any[]>("/executions/"),
  getEmailLogs: (id: number) => apiRequest<any[]>(`/executions/${id}/logs`),
  
  getSchedules: () => apiRequest<any[]>("/schedules/"),
  cancelSchedule: (id: number) =>
    apiRequest(`/schedules/${id}`, { method: "DELETE" }),
  
  getRecipes: () => apiRequest<any[]>("/campaigns/recipes"),
};
