import { useCallback, useRef } from "react";

export interface Snapshot<T> {
  data: T;
}

export function useUndo<T>(maxHistory = 50) {
  const pastRef = useRef<Snapshot<T>[]>([]);
  const futureRef = useRef<Snapshot<T>[]>([]);

  const pushSnapshot = useCallback((data: T) => {
    pastRef.current = [...pastRef.current.slice(-(maxHistory - 1)), { data }];
    futureRef.current = [];
  }, [maxHistory]);

  const undo = useCallback((current: T): T | null => {
    const past = pastRef.current;
    if (past.length === 0) return null;
    const previous = past[past.length - 1];
    pastRef.current = past.slice(0, -1);
    futureRef.current = [...futureRef.current, { data: current }];
    return previous.data;
  }, []);

  const redo = useCallback((current: T): T | null => {
    const future = futureRef.current;
    if (future.length === 0) return null;
    const next = future[future.length - 1];
    futureRef.current = future.slice(0, -1);
    pastRef.current = [...pastRef.current, { data: current }];
    return next.data;
  }, []);

  const canUndo = useCallback(() => pastRef.current.length > 0, []);
  const canRedo = useCallback(() => futureRef.current.length > 0, []);

  const clear = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
  }, []);

  return { pushSnapshot, undo, redo, canUndo, canRedo, clear };
}
