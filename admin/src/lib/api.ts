import { redirect } from "next/navigation";
import type { ApiResponse, ApiSuccess } from "@taptapsell/types";
import { getAccessToken } from "./session";
import { clientHeaders } from "./forwarding";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
}

export interface Page<T> {
  data: T;
  meta: { page: number; limit: number; total: number };
}

async function request<T>(path: string, options: RequestOptions): Promise<ApiSuccess<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await clientHeaders()),
  };
  const token = await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !payload || payload.success === false) {
    const error = payload && payload.success === false ? payload.error : null;
    // Platform users must turn on two-step verification before anything else.
    if (error?.code === "MFA_SETUP_REQUIRED") redirect("/security");
    if (response.status === 401) redirect("/login");
    throw new ApiRequestError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? "Request failed",
    );
  }

  return payload;
}

/** Server-side API client: Server Components and Server Actions only. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await request<T>(path, options)).data;
}

/** For paginated list endpoints, which also return totals. */
export async function apiFetchPage<T>(path: string): Promise<Page<T>> {
  const payload = await request<T>(path, {});
  return {
    data: payload.data,
    meta: (payload.meta as Page<T>["meta"]) ?? { page: 1, limit: 25, total: 0 },
  };
}

export { API_BASE_URL };
