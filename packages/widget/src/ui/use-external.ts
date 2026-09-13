import { useEffect, useState } from 'preact/hooks';

export function useExternal<T>(
  subscribe: (listener: (value: T) => void) => () => void,
  getSnapshot: () => T,
): T {
  const [value, setValue] = useState<T>(getSnapshot);
  useEffect(() => {
    setValue(getSnapshot());
    return subscribe(() => setValue(getSnapshot()));
  }, [subscribe, getSnapshot]);
  return value;
}
