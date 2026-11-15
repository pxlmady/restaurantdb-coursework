import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

// Запит, що повторюється після кожної зміни форми (вільний столик, розрахунок передзамовлення).
// request — { method: 'get' | 'post', path, body? } або null, якщо форма ще не заповнена.
// Запит іде через 300 мс після останньої зміни; застарілі відповіді відкидаються.
export function useSiteRequest(request) {
  const key = request ? JSON.stringify(request) : null;
  const [state, setState] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      const { method, path, body } = JSON.parse(key);
      api[method](path, body).then(
        (data) => active && setState({ key, data, error: null }),
        (error) => active && setState({ key, data: null, error }),
      );
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key]);

  if (!key) return { data: null, error: null, loading: false };
  const current = state.key === key;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: !current,
  };
}
