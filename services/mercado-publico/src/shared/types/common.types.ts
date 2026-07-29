// ============================================================
// Common domain types used across all modules
// ============================================================

export type UUID = string;
export type ISODateString = string;
export type CLP = number;

export type PaginationParams = {
  page: number;
  limit: number;
};

export type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type SortOrder = 'asc' | 'desc';

export type ApiResponse<T> = {
  success: true;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
