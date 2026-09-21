import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ApiError, apiFetch } from "./api";

interface QueryState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/** Fetches on mount and whenever the screen regains focus, so progress stays current. */
export function useApiQuery<T>(path: string): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await apiFetch<T>(path));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load. Pull to retry.");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { data, error, loading, refresh: load };
}
