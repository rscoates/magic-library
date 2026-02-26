import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  TablePagination,
  Typography,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Save as SaveIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { collectionApi, metadataApi } from '../api';
import type { CollectionEntry, Language, Finish } from '../types';
import { getErrorMessage } from '../api/client';

export default function CollectionEntries() {
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [filtered, setFiltered] = useState<CollectionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [languages, setLanguages] = useState<Language[]>([]);
  const [finishes, setFinishes] = useState<Finish[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [dirtyIds, setDirtyIds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, filterText]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [e, langs, fins] = await Promise.all([
        collectionApi.list(),
        metadataApi.listLanguages(),
        metadataApi.listFinishes(),
      ]);
      setEntries(e);
      setLanguages(langs);
      setFinishes(fins);
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    const q = filterText.trim().toLowerCase();
    if (!q) {
      setFiltered(entries);
      return;
    }
    setFiltered(
      entries.filter((en) =>
        [en.card_name, en.set_code, en.card_number, en.container_name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
    );
    setPage(0);
  };

  const handleChangeRow = (id: number, changes: Partial<CollectionEntry>) => {
    setEntries((prev) => prev.map((r) => (r.id === id ? { ...r, ...changes } : r)));
    setDirtyIds((d) => ({ ...d, [id]: true }));
  };

  const handleSave = async (id: number) => {
    const row = entries.find((r) => r.id === id);
    if (!row) return;
    try {
      await collectionApi.update(id, {
        quantity: row.quantity,
        finish_id: row.finish_id ?? null,
        language_id: row.language_id,
        comments: row.comments ?? null,
        position: row.position ?? null,
      });
      setDirtyIds((d) => {
        const copy = { ...d };
        delete copy[id];
        return copy;
      });
      // refresh the entry from server to get computed names
      const refreshed = await collectionApi.list();
      setEntries(refreshed);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this collection entry?')) return;
    try {
      await collectionApi.delete(id);
      setEntries((prev) => prev.filter((r) => r.id !== id));
      setDirtyIds((d) => {
        const copy = { ...d };
        delete copy[id];
        return copy;
      });
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const rowsToShow = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Collection Entries
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          label="Filter"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filter by card, set, container..."
          size="small"
        />
        <Button variant="outlined" onClick={loadAll} disabled={loading}>
          Refresh
        </Button>
      </Box>

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Card</TableCell>
                <TableCell>Container</TableCell>
                <TableCell>Quantity</TableCell>
                <TableCell>Finish</TableCell>
                <TableCell>Language</TableCell>
                <TableCell>Comments</TableCell>
                <TableCell>Position</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rowsToShow.map((row) => (
                <TableRow key={row.id} selected={!!dirtyIds[row.id]}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>
                    <div>{row.card_name}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {row.set_code} / {row.card_number}
                    </div>
                  </TableCell>
                  <TableCell>{row.container_name}</TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={row.quantity}
                      onChange={(e) => handleChangeRow(row.id, { quantity: parseInt(e.target.value || '0', 10) })}
                      inputProps={{ min: 1 }}
                    />
                  </TableCell>
                  <TableCell>
                    <FormControl size="small" fullWidth>
                      <InputLabel id={`finish-label-${row.id}`}>Finish</InputLabel>
                      <Select
                        labelId={`finish-label-${row.id}`}
                        value={row.finish_id ?? ''}
                        label="Finish"
                        onChange={(e) => handleChangeRow(row.id, { finish_id: e.target.value === '' ? null : Number(e.target.value) })}
                      >
                        <MenuItem value="">(none)</MenuItem>
                        {finishes.map((f) => (
                          <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell>
                    <FormControl size="small" fullWidth>
                      <InputLabel id={`lang-label-${row.id}`}>Language</InputLabel>
                      <Select
                        labelId={`lang-label-${row.id}`}
                        value={row.language_id}
                        label="Language"
                        onChange={(e) => handleChangeRow(row.id, { language_id: Number(e.target.value) })}
                      >
                        {languages.map((l) => (
                          <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={row.comments ?? ''}
                      onChange={(e) => handleChangeRow(row.id, { comments: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={row.position ?? ''}
                      onChange={(e) => handleChangeRow(row.id, { position: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleSave(row.id)} disabled={!dirtyIds[row.id]} title="Save">
                      <SaveIcon />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(row.id)} title="Delete">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>
    </Box>
  );
}
