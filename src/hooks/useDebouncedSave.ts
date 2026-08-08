import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useDebouncedSave<T>(
  value: T,
  save: (value: T) => Promise<unknown>,
  delay = 500,
) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const firstValue = useRef(true);
  const latestValue = useRef(value);
  const isSaving = useRef(false);
  const queued = useRef(false);
  latestValue.current = value;

  const persist = useCallback(async () => {
    if (isSaving.current) {
      queued.current = true;
      return;
    }
    isSaving.current = true;
    setStatus("saving");
    setError(null);
    try {
      do {
        queued.current = false;
        await save(latestValue.current);
      } while (queued.current);
      setStatus("saved");
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "Could not save your changes.");
    } finally {
      isSaving.current = false;
    }
  }, [save]);

  useEffect(() => {
    if (firstValue.current) {
      firstValue.current = false;
      return;
    }
    setStatus("saving");
    const timer = window.setTimeout(() => void persist(), delay);
    return () => window.clearTimeout(timer);
  }, [delay, persist, value]);

  return { status, error, retry: persist };
}
