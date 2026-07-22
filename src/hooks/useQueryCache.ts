import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseQueryCacheOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  /** Tiempo en ms en que los datos se consideran frescos (default 5 minutos = 300_000ms) */
  staleTime?: number;
  /** Si es true, guarda en sessionStorage para sobrevivir a navegaciones */
  persistSession?: boolean;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// In-memory global cache map
const memoryCache = new Map<string, CacheEntry<unknown>>();

export function useQueryCache<T>({
  key,
  fetcher,
  staleTime = 5 * 60 * 1000,
  persistSession = true,
}: UseQueryCacheOptions<T>) {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError]     = useState<Error | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Helper to read from cache (memory or sessionStorage)
  const getCached = useCallback((): CacheEntry<T> | null => {
    // 1. Try memory cache
    if (memoryCache.has(key)) {
      return memoryCache.get(key) as CacheEntry<T>;
    }
    // 2. Try sessionStorage
    if (persistSession && typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(`bralidus_cache_${key}`);
        if (raw) {
          const parsed = JSON.parse(raw) as CacheEntry<T>;
          memoryCache.set(key, parsed as CacheEntry<unknown>);
          return parsed;
        }
      } catch (e) {
        console.warn(`[useQueryCache] Failed to parse sessionStorage for key: ${key}`);
      }
    }
    return null;
  }, [key, persistSession]);

  // Helper to write to cache
  const setCached = useCallback((newData: T) => {
    const entry: CacheEntry<T> = { data: newData, timestamp: Date.now() };
    memoryCache.set(key, entry as CacheEntry<unknown>);
    if (persistSession && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`bralidus_cache_${key}`, JSON.stringify(entry));
      } catch (e) {
        console.warn(`[useQueryCache] Failed to write sessionStorage for key: ${key}`);
      }
    }
  }, [key, persistSession]);

  const executeFetch = useCallback(async (ignoreCache = false) => {
    const cached = getCached();
    const now = Date.now();

    // Return cached immediately if valid and not stale
    if (!ignoreCache && cached) {
      setData(cached.data);
      setLoading(false);

      const age = now - cached.timestamp;
      if (age < staleTime) {
        setIsStale(false);
        return; // Cache is fresh! No fetch needed.
      }
      setIsStale(true);
    }

    // Fetch fresh data
    try {
      setLoading(!cached); // Keep cached UI while background fetching
      setError(null);
      const result = await fetcherRef.current();
      setData(result);
      setCached(result);
      setIsStale(false);
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      console.error(`[useQueryCache] Error fetching key "${key}":`, errorObj);
    } finally {
      setLoading(false);
    }
  }, [getCached, key, setCached, staleTime]);

  useEffect(() => {
    executeFetch();
  }, [executeFetch]);

  const refetch = useCallback(() => {
    return executeFetch(true);
  }, [executeFetch]);

  const clearCache = useCallback(() => {
    memoryCache.delete(key);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`bralidus_cache_${key}`);
    }
  }, [key]);

  return { data, loading, error, isStale, refetch, clearCache };
}

export default useQueryCache;
