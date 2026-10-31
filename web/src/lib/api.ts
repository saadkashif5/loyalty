import { redirect } from "next/navigation";
import type { ApiResponse } from "@taptapsell/types";
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
  /** Send without an Authorization header (public discovery endpoints). */
  anonymous?: boolean;
  idempotencyKey?: string;
  cache?: RequestCache;
}

/**
 * Server-side API client. Runs in Server Components and Route Handlers only,
 * so the access token never has to reach the browser.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await clientHeaders()),
  };

  if (!options.anonymous) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: options.cache ?? "no-store",
  });

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !payload || payload.success === false) {
    const error = payload && payload.success === false ? payload.error : null;
    // Owners and platform users must turn on two-step verification before anything else.
    if (error?.code === "MFA_SETUP_REQUIRED") redirect("/account/security?welcome=1");
    throw new ApiRequestError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? "Request failed",
    );
  }

  return payload.data;
}

export { API_BASE_URL };

export interface Page<T> {
  data: T;
  meta: { page: number; limit: number; total: number };
}

/** For paginated list endpoints, which also return totals. */
export async function apiFetchPage<T>(path: string): Promise<Page<T>> {
  const token = await getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(await clientHeaders()),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    (ApiResponse<T> & { meta?: Page<T>["meta"] }) | null;

  if (!response.ok || !payload || payload.success === false) {
    const error = payload && payload.success === false ? payload.error : null;
    if (error?.code === "MFA_SETUP_REQUIRED") redirect("/account/security?welcome=1");
    throw new ApiRequestError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? "Request failed",
    );
  }

  return {
    data: payload.data,
    meta: payload.meta ?? { page: 1, limit: 25, total: 0 },
  };
}
