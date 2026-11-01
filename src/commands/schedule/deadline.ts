/**
 * Rejects when work runs past ms. The work itself keeps going: onLate receives its result
 * if it finishes after the timeout, so the caller can undo it.
 */
export function within<T>(ms: number, work: Promise<T>, label: string, onLate?: (value: T) => unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    let late = false;
    const timer = setTimeout(() => {
      late = true;
      reject(new Error(`${label} took too long.`));
    }, ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        if (late) {
          void Promise.resolve()
            .then(() => onLate?.(value))
            .catch(() => undefined);
          return;
        }
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(label));
      },
    );
  });
}
