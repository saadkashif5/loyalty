// Shared response envelope used by the API (see api/src/utils/response.ts)
// and consumed by web/mobile clients for consistent typing.

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    [key: string]: unknown;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  correlationId?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
