import QueryPage from '../../components/QueryPage.jsx';
import { useApiData } from '../../hooks/useApiData.js';

// Запит, фільтрам якого потрібні списки офіціантів і столиків з CRUD API
function QueryWithLookups({ query }) {
  const waiters = useApiData('/waiters');
  const tables = useApiData('/tables');
  return <QueryPage query={query} lookups={{ waiters: waiters.data, tables: tables.data }} />;
}

// key: під час переходу між запитами стан фільтрів не переноситься на іншу сторінку
export default function QueryRoute({ query }) {
  return query.needsLookups ? (
    <QueryWithLookups key={query.code} query={query} />
  ) : (
    <QueryPage key={query.code} query={query} />
  );
}
