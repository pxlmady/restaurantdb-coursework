import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { api } from '../api/client.js';
import { useApiData } from '../hooks/useApiData.js';
import { useNotify } from '../lib/notify-context.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import DataTable from './DataTable.jsx';
import FormDialog from './FormDialog.jsx';

// Типова сторінка CRUD для однієї таблиці бази:
// список (GET), створення (POST), редагування (PUT), видалення (DELETE) через API етапу 6.
//
// entity: {
//   endpoint: '/visitors',           шлях API
//   getId(row),                      первинний ключ запису (для адреси /visitors/:id)
//   names: { add, create, edit(row), deleteTitle, deleteText(row), saved(row), deleted(row) },
//   columns, getSearchText,          див. DataTable
//   fields: [...] | (values, row) => [...],   див. FormField; row — запис, що редагується, або null
//   emptyValues, toValues(row),      початкові значення форми (створення / редагування)
//   toBody(values)                   тіло запиту (за замовчуванням значення форми як є)
// }
// filterRows, toolbar, renderDetail, renderDialog — додаткові можливості для складніших сторінок;
// onChanged() викликається після збереження чи видалення (оновити пов'язані довідники).
export default function CrudPage({
  title,
  description,
  entity,
  data,
  filterRows,
  toolbar,
  renderDetail,
  renderDialog,
  onChanged,
}) {
  const own = useApiData(entity.endpoint);
  const { data: rows, loading, error, reload } = data ?? own;
  const notify = useNotify();
  const [editing, setEditing] = useState(null); // { row } — row === null для нового запису
  const [deleting, setDeleting] = useState(null);

  const { names } = entity;
  const toBody = entity.toBody ?? ((values) => values);

  const save = async (values) => {
    const row = editing.row;
    const body = toBody(values, row);
    const saved = row
      ? await api.put(`${entity.endpoint}/${entity.getId(row)}`, body)
      : await api.post(entity.endpoint, body);
    setEditing(null);
    notify(names.saved(saved, Boolean(row)));
    reload();
    onChanged?.();
  };

  const remove = async () => {
    try {
      await api.delete(`${entity.endpoint}/${entity.getId(deleting)}`);
      notify(names.deleted(deleting));
      reload();
      onChanged?.();
    } catch (err) {
      notify(err.message, 'error');
    }
    setDeleting(null);
  };

  const closeDialog = () => setEditing(null);

  const dialog =
    editing &&
    (renderDialog ? (
      renderDialog({ row: editing.row, onSubmit: save, onClose: closeDialog })
    ) : (
      <FormDialog
        title={editing.row ? names.edit(editing.row) : names.create}
        fields={
          typeof entity.fields === 'function'
            ? (values) => entity.fields(values, editing.row)
            : entity.fields
        }
        initialValues={editing.row ? entity.toValues(editing.row) : entity.emptyValues()}
        onSubmit={save}
        onClose={closeDialog}
      />
    ));

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        {title}
      </Typography>
      {description && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
      )}
      <DataTable
        columns={entity.columns}
        rows={rows && filterRows ? rows.filter(filterRows) : rows}
        getRowId={entity.getId}
        loading={loading}
        error={error}
        onRetry={reload}
        getSearchText={entity.getSearchText}
        searchPlaceholder={entity.searchPlaceholder}
        toolbar={toolbar}
        addLabel={names.add}
        onAdd={() => setEditing({ row: null })}
        onEdit={(row) => setEditing({ row })}
        onDelete={setDeleting}
        renderDetail={renderDetail}
        initialSort={entity.initialSort}
        numbered={entity.numbered ?? true}
      />
      {dialog}
      {deleting && (
        <ConfirmDialog
          title={names.deleteTitle}
          text={names.deleteText(deleting)}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </Box>
  );
}
