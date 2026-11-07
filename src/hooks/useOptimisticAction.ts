import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

export interface OptimisticActionOptions<TState, TPayload, TResult = any> {
  currentState: TState;
  updateLocalState: (newState: TState) => void;
  optimisticTransform: (prev: TState, payload: TPayload) => TState;
  serverMutation: (payload: TPayload) => Promise<TResult>;
  onSuccess?: (result: TResult, payload: TPayload) => void;
  onError?: (error: any, rollbackState: TState, payload: TPayload) => void;
  successMessage?: string | ((result: TResult) => string);
  errorMessage?: string | ((error: any) => string);
}

/**
 * Enterprise hook for executing optimistic state updates with automatic
 * rollback, toast feedback, and duplicate invocation prevention.
 */
export function useOptimisticAction<TState, TPayload, TResult = any>() {
  const [isMutating, setIsMutating] = useState(false);
  const isExecutingRef = useRef(false);

  const execute = useCallback(
    async (
      options: OptimisticActionOptions<TState, TPayload, TResult>,
      payload: TPayload
    ): Promise<{ success: boolean; data?: TResult; error?: any }> => {
      if (isExecutingRef.current) {
        return { success: false, error: new Error('Action already in progress') };
      }

      const {
        currentState,
        updateLocalState,
        optimisticTransform,
        serverMutation,
        onSuccess,
        onError,
        successMessage,
        errorMessage,
      } = options;

      // 1. Snapshot previous state for rollback
      const previousState = currentState;

      // 2. Apply optimistic transform immediately
      const nextOptimisticState = optimisticTransform(previousState, payload);
      updateLocalState(nextOptimisticState);

      isExecutingRef.current = true;
      setIsMutating(true);

      try {
        // 3. Dispatch authoritative server mutation
        const result = await serverMutation(payload);

        // 4. Fire success hook and notification
        if (onSuccess) {
          onSuccess(result, payload);
        }
        if (successMessage) {
          const msg = typeof successMessage === 'function' ? successMessage(result) : successMessage;
          toast.success(msg);
        }

        return { success: true, data: result };
      } catch (err: any) {
        // 5. Rollback on failure
        updateLocalState(previousState);

        const errorMsg =
          typeof errorMessage === 'function'
            ? errorMessage(err)
            : errorMessage || err?.message || 'Action failed. Rolling back changes.';

        toast.error(errorMsg);

        if (onError) {
          onError(err, previousState, payload);
        }

        return { success: false, error: err };
      } finally {
        isExecutingRef.current = false;
        setIsMutating(false);
      }
    },
    []
  );

  return {
    execute,
    isMutating,
  };
}
