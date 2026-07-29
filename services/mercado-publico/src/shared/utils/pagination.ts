import type { PaginatedResult } from '../types/common.types';

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export function getPaginationOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}
