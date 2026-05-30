/** Shared API response envelope types used by both the server and mobile client. */

export interface ApiSuccess<T> {
  readonly data: T;
  readonly ok: true;
}

export interface ApiError {
  readonly error: string;
  readonly ok: false;
  readonly statusCode: number;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface PaginationMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface PaginatedResponse<T> extends ApiSuccess<T[]> {
  readonly meta: PaginationMeta;
}
