import { useState, useEffect, useRef, useCallback } from 'react';

export type AutosaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

export interface UseAutosaveOptions<T> {
  data: T;
  onSave: (data: T) => Promise<any> | any;
  delayMs?: number;
  enabled?: boolean;
  isEqual?: (a: T, b: T) => boolean;
}

export interface UseAutosaveReturn {
  status: AutosaveStatus;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt: Date | null;
  error: string | null;
  saveNow: () => Promise<boolean>;
  resetStatus: () => void;
}

/**
 * Enterprise Autosave hook with debouncing, status reporting,
 * and conflict-safe execution.
 */
export function useAutosave<T>({
  data,
  onSave,
  delayMs = 1200,
  enabled = true,
  isEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b),
}: UseAutosaveOptions<T>): UseAutosaveReturn {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initialDataRef = useRef<T>(data);
  const lastSavedDataRef = useRef<T>(data);
  const currentDataRef = useRef<T>(data);
  const onSaveRef = useRef(onSave);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef<boolean>(false);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    currentDataRef.current = data;
  }, [data]);

  const executeSave = useCallback(async (targetData: T): Promise<boolean> => {
    if (isSavingRef.current) return false;
    isSavingRef.current = true;
    setStatus('saving');
    setError(null);

    try {
      await onSaveRef.current(targetData);
      lastSavedDataRef.current = targetData;
      setLastSavedAt(new Date());
      setStatus('saved');
      return true;
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to auto-save changes.';
      setError(errMsg);
      setStatus('error');
      return false;
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return executeSave(currentDataRef.current);
  }, [executeSave]);

  const resetStatus = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Check if data changed compared to last saved data
    const hasChanged = !isEqual(data, lastSavedDataRef.current);
    if (!hasChanged) {
      return;
    }

    setStatus('unsaved');

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      executeSave(currentDataRef.current);
    }, delayMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [data, delayMs, enabled, isEqual, executeSave]);

  return {
    status,
    isSaving: status === 'saving',
    hasUnsavedChanges: status === 'unsaved',
    lastSavedAt,
    error,
    saveNow,
    resetStatus,
  };
}
