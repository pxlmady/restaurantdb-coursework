import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

// Завантажує дані GET-запитом. reload() повторює запит (після створення, зміни чи видалення).
export function useApiData(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    api.get(path).then(
      (data) => active && setState({ data, error: null, loading: false }),
      (error) => active && setState((prev) => ({ data: prev.data, error, loading: false })),
    );
    return () => {
      active = false;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
