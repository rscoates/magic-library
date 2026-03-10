import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Button,
  Collapse,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Snackbar,
  Chip,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  MergeType as MergeIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { collectionApi, containersApi } from '../api';
import { getErrorMessage } from '../api/client';
import type { DuplicateCard, Container } from '../types';

// Flatten the container tree into a list with path labels (exclude decks)
function flattenContainers(
  containers: Container[],
  parentPath = '',
): { id: number; label: string }[] {
  const result: { id: number; label: string }[] = [];
  for (const c of containers) {
    // Exclude deck containers
    if (c.container_type.name.toLowerCase() === 'deck') continue;
    if (c.is_sold) continue;
    const path = parentPath ? `${parentPath} > ${c.name}` : c.name;
    result.push({ id: c.id, label: path });
    if (c.children?.length) {
      result.push(...flattenContainers(c.children, path));
    }
  }
  return result;
}

export default function FindDuplicates() {
  const [duplicates, setDuplicates] = useState<DuplicateCard[]>([]);
  const [filteredDuplicates, setFilteredDuplicates] = useState<DuplicateCard[]>([]);
  const [containers, setContainers] = useState<{ id: number; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [consolidateTargets, setConsolidateTargets] = useState<Record<string, number>>({});
  const [consolidating, setConsolidating] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [filterText, setFilterText] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dupData, allContainers] = await Promise.all([
        collectionApi.getDuplicates(),
        containersApi.listAll(),
      ]);
      setDuplicates(dupData.duplicates);
      setFilteredDuplicates(dupData.duplicates);
      setContainers(flattenContainers(allContainers));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter duplicates when filter text changes
  useEffect(() => {
    if (!filterText.trim()) {
      setFilteredDuplicates(duplicates);
    } else {
      const lower = filterText.toLowerCase();
      setFilteredDuplicates(
        duplicates.filter((d) => d.card_name.toLowerCase().includes(lower)),
      );
    }
  }, [filterText, duplicates]);

  const toggleRow = (cardName: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(cardName)) {
        next.delete(cardName);
      } else {
        next.add(cardName);
      }
      return next;
    });
  };

  const handleConsolidate = async (cardName: string) => {
    const targetId = consolidateTargets[cardName];
    if (!targetId) return;

    setConsolidating(cardName);
    try {
      const result = await collectionApi.consolidate(cardName, targetId);
      setSnackbar({ open: true, message: result.message, severity: 'success' });
      // Refresh the data
      await loadData();
    } catch (err) {
      setSnackbar({ open: true, message: getErrorMessage(err), severity: 'error' });
    } finally {
      setConsolidating(null);
    }
  };

  const handleConsolidateAll = async () => {
    // Consolidate all cards that have a target selected
    const cardsToConsolidate = filteredDuplicates.filter(
      (d) => consolidateTargets[d.card_name],
    );
    if (cardsToConsolidate.length === 0) return;

    setConsolidating('__all__');
    let successCount = 0;
    let errorCount = 0;
    for (const dup of cardsToConsolidate) {
      try {
        await collectionApi.consolidate(dup.card_name, consolidateTargets[dup.card_name]);
        successCount++;
      } catch {
        errorCount++;
      }
    }

    if (errorCount === 0) {
      setSnackbar({
        open: true,
        message: `Consolidated ${successCount} card(s) successfully`,
        severity: 'success',
      });
    } else {
      setSnackbar({
        open: true,
        message: `Consolidated ${successCount}, failed ${errorCount}`,
        severity: errorCount === cardsToConsolidate.length ? 'error' : 'success',
      });
    }
    setConsolidating(null);
    await loadData();
  };

  const setAllTargets = (containerId: number) => {
    const targets: Record<string, number> = {};
    for (const d of filteredDuplicates) {
      targets[d.card_name] = containerId;
    }
    setConsolidateTargets((prev) => ({ ...prev, ...targets }));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5">
          Find Duplicates
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadData}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Cards that appear in more than one box or file (decks are excluded). Select a target container and consolidate to move all copies into one place.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : duplicates.length === 0 ? (
        <Alert severity="info">No duplicate cards found across your boxes and files.</Alert>
      ) : (
        <>
          {/* Bulk controls */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Filter by card name..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 220 }}
              />
              <FormControl size="small" sx={{ minWidth: 250 }}>
                <InputLabel>Set all targets to...</InputLabel>
                <Select
                  label="Set all targets to..."
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setAllTargets(Number(e.target.value));
                  }}
                >
                  {containers.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                startIcon={consolidating === '__all__' ? <CircularProgress size={16} color="inherit" /> : <MergeIcon />}
                onClick={handleConsolidateAll}
                disabled={
                  consolidating !== null ||
                  filteredDuplicates.filter((d) => consolidateTargets[d.card_name]).length === 0
                }
              >
                Consolidate All ({filteredDuplicates.filter((d) => consolidateTargets[d.card_name]).length})
              </Button>
              <Chip
                label={`${filteredDuplicates.length} duplicate card${filteredDuplicates.length !== 1 ? 's' : ''}`}
                color="primary"
                variant="outlined"
              />
            </Box>
          </Paper>

          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={40} />
                  <TableCell><strong>Card Name</strong></TableCell>
                  <TableCell align="center"><strong>Total Qty</strong></TableCell>
                  <TableCell align="center"><strong>Containers</strong></TableCell>
                  <TableCell><strong>Consolidate Into</strong></TableCell>
                  <TableCell align="center"><strong>Action</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDuplicates.map((dup) => {
                  const isExpanded = expandedRows.has(dup.card_name);
                  const targetId = consolidateTargets[dup.card_name];
                  const isConsolidating = consolidating === dup.card_name;

                  return (
                    <>
                      <TableRow
                        key={dup.card_name}
                        hover
                        sx={{ '& > *': { borderBottom: isExpanded ? 'unset' : undefined } }}
                      >
                        <TableCell>
                          <IconButton size="small" onClick={() => toggleRow(dup.card_name)}>
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </TableCell>
                        <TableCell>{dup.card_name}</TableCell>
                        <TableCell align="center">{dup.total_quantity}</TableCell>
                        <TableCell align="center">
                          <Chip label={dup.container_count} size="small" color="warning" />
                        </TableCell>
                        <TableCell>
                          <FormControl size="small" fullWidth>
                            <Select
                              value={targetId || ''}
                              displayEmpty
                              onChange={(e) =>
                                setConsolidateTargets((prev) => ({
                                  ...prev,
                                  [dup.card_name]: Number(e.target.value),
                                }))
                              }
                            >
                              <MenuItem value="" disabled>
                                <em>Select target...</em>
                              </MenuItem>
                              {containers.map((c) => (
                                <MenuItem key={c.id} value={c.id}>
                                  {c.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={
                              isConsolidating ? (
                                <CircularProgress size={14} color="inherit" />
                              ) : (
                                <MergeIcon />
                              )
                            }
                            onClick={() => handleConsolidate(dup.card_name)}
                            disabled={!targetId || consolidating !== null}
                          >
                            Move
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow key={`${dup.card_name}-detail`}>
                        <TableCell colSpan={6} sx={{ py: 0 }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ py: 1, pl: 4 }}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Container</TableCell>
                                    <TableCell>Set</TableCell>
                                    <TableCell>Number</TableCell>
                                    <TableCell align="center">Qty</TableCell>
                                    <TableCell>Finish</TableCell>
                                    <TableCell>Language</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {dup.locations.map((loc) => (
                                    <TableRow key={loc.entry_id}>
                                      <TableCell>{loc.container_path}</TableCell>
                                      <TableCell>{loc.set_code}</TableCell>
                                      <TableCell>{loc.card_number}</TableCell>
                                      <TableCell align="center">{loc.quantity}</TableCell>
                                      <TableCell>{loc.finish_name || '—'}</TableCell>
                                      <TableCell>{loc.language_name}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
