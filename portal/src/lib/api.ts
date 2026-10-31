import crypto from "node:crypto";
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
  /** Send without the customer's session (public endpoints). */
  anonymous?: boolean;
  idempotencyKey?: string;
}

/** Server-side API client: Server Components, Server Actions and Route Handlers only. */
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
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!response.ok || !payload || payload.success === false) {
    const error = payload && payload.success === false ? payload.error : null;
    // A session that is no longer valid (e.g. the account was suspended): sign in again.
    if (response.status === 401 && !options.anonymous) redirect("/signin");
    throw new ApiRequestError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? "Something went wrong. Please try again.",
    );
  }
  return payload.data;
}

/** One key per tap, so a retried request cannot add a second stamp. */
export function idempotencyKeyFor(tapToken: string): string {
  return `tap-${crypto.createHash("sha256").update(tapToken).digest("hex").slice(0, 40)}`;
}

export { API_BASE_URL };
