import { useEffect, useState } from 'react';

// The UI is always in exactly one of these three states
export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

// Runs `load` and tracks its result. `load` must be defined outside the
// component (so it's the same function every render), or it would refetch forever.
export function useAsync<T>(load: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;

    load()
      .then((data) => {
        if (!ignore) setState({ status: 'success', data });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Something went wrong';
        if (!ignore) setState({ status: 'error', message });
      });

    // Cleanup: if this effect re-runs or the component unmounts,
    // ignore the old request's result
    return () => {
      ignore = true;
    };
  }, [load, attempt]);

  function retry() {
    setState({ status: 'loading' });
    setAttempt(attempt + 1);
  }

  return { state, retry };
}