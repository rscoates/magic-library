import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Chip,
  Collapse,
  IconButton,
  Divider,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  MoveDown as MoveIcon,
} from '@mui/icons-material';
import { decklistApi, containersApi, collectionApi } from '../api';
import { getErrorMessage } from '../api/client';
import type { DecklistResult, DecklistCardResult, Container, DecklistCardLocation } from '../types';

export default function DecklistChecker() {
  const [decklist, setDecklist] = useState('');
  const [result, setResult] = useState<DecklistResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Move functionality state
  const [flatContainers, setFlatContainers] = useState<{ id: number; path: string }[]>([]);
  const [targetContainer, setTargetContainer] = useState<{ id: number; path: string } | null>(null);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveLocation, setMoveLocation] = useState<DecklistCardLocation | null>(null);
  const [moveQuantity, setMoveQuantity] = useState(1);
  const [moveLoading, setMoveLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [movedEntries, setMovedEntries] = useState<Map<number, { newPath: string; newQty: number }>>(new Map());

  // Load containers for move dropdown
  useEffect(() => {
    const loadContainers = async () => {
      try {
        const data = await containersApi.listAll();
        // Flatten containers with paths
        const flat: { id: number; path: string }[] = [];
        const buildPath = (container: Container, parentPath = ''): void => {
          const path = parentPath ? `${parentPath} > ${container.name}` : container.name;
          flat.push({ id: container.id, path });
          container.children?.forEach((child) => buildPath(child, path));
        };
        data.forEach((c) => buildPath(c));
        setFlatContainers(flat);
      } catch (err) {
        console.error('Failed to load containers:', err);
      }
    };
    loadContainers();
  }, []);

  const handleMoveClick = (loc: DecklistCardLocation) => {
    setMoveLocation(loc);
    setMoveQuantity(Math.min(loc.quantity, 1));
    setMoveDialogOpen(true);
  };

  const handleMoveConfirm = async () => {
    if (!moveLocation || !targetContainer) return;

    setMoveLoading(true);
    try {
      const response = await collectionApi.move(moveLocation.entry_id, moveQuantity, targetContainer.id);
      setSnackbar({ open: true, message: response.message, severity: 'success' });
      
      // Track moved entry for UI feedback
      setMovedEntries((prev) => {
        const next = new Map(prev);
        next.set(moveLocation.entry_id, {
          newPath: response.target_container_path,
          newQty: moveQuantity,
        });
        return next;
      });
      
      setMoveDialogOpen(false);
    } catch (err) {
      setSnackbar({ open: true, message: getErrorMessage(err), severity: 'error' });
    } finally {
      setMoveLoading(false);
    }
  };

  const handleCheck = async () => {
    if (!decklist.trim()) return;

    setLoading(true);
    setError('');

    try {
      const data = await decklistApi.check(decklist);
      setResult(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

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

  const getStatusIcon = (card: DecklistCardResult) => {
    if (card.missing_quantity === 0) {
      return <CheckIcon color="success" />;
    }
    if (card.owned_quantity > 0) {
      return <WarningIcon color="warning" />;
    }
    return <ErrorIcon color="error" />;
  };

  const mainDeck = result?.cards.filter((c) => !c.is_sideboard) || [];
  const sideboard = result?.cards.filter((c) => c.is_sideboard) || [];

  const renderCardTable = (cards: DecklistCardResult[], title: string) => (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={40} />
              <TableCell width={40}>Status</TableCell>
              <TableCell>Card Name</TableCell>
              <TableCell align="right">Need</TableCell>
              <TableCell align="right">Have</TableCell>
              <TableCell align="right">Missing</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cards.map((card) => {
              const isExpanded = expandedRows.has(card.card_name);

              return (
                <>
                  <TableRow
                    key={card.card_name}
                    hover
                    onClick={() => card.locations.length > 0 && toggleRow(card.card_name)}
                    sx={{ cursor: card.locations.length > 0 ? 'pointer' : 'default' }}
                  >
                    <TableCell>
                      {card.locations.length > 0 && (
                        <IconButton size="small">
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      )}
                    </TableCell>
                    <TableCell>{getStatusIcon(card)}</TableCell>
                    <TableCell>
                      <Typography fontWeight="medium">{card.card_name}</Typography>
                    </TableCell>
                    <TableCell align="right">{card.requested_quantity}</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={card.owned_quantity}
                        size="small"
                        color={card.owned_quantity >= card.requested_quantity ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {card.missing_quantity > 0 ? (
                        <Chip label={card.missing_quantity} size="small" color="error" />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                  {card.locations.length > 0 && (
                    <TableRow key={`${card.card_name}-details`}>
                      <TableCell colSpan={6} sx={{ py: 0 }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 2, pl: 6 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Available copies:
                            </Typography>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Set</TableCell>
                                  <TableCell>Location</TableCell>
                                  <TableCell>Language</TableCell>
                                  <TableCell>Finish</TableCell>
                                  <TableCell align="right">Qty</TableCell>
                                  <TableCell width={120}>Action</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {card.locations.map((loc, idx) => {
                                  const moved = movedEntries.get(loc.entry_id);
                                  return (
                                    <TableRow key={idx} sx={moved ? { bgcolor: 'success.light', opacity: 0.8 } : {}}>
                                      <TableCell>
                                        <Chip
                                          label={`${loc.set_code} #${loc.card_number}`}
                                          size="small"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        {loc.container_path}
                                        {moved && (
                                          <Typography variant="caption" color="success.dark" display="block">
                                            → Moved {moved.newQty} to {moved.newPath}
                                          </Typography>
                                        )}
                                      </TableCell>
                                      <TableCell>{loc.language_name}</TableCell>
                                      <TableCell>{loc.finish_name || 'Non-Foil'}</TableCell>
                                      <TableCell align="right">{loc.quantity}</TableCell>
                                      <TableCell>
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          startIcon={<MoveIcon />}
                                          disabled={!targetContainer}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMoveClick(loc);
                                          }}
                                        >
                                          Move
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Check Decklist Against Collection
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Paste your decklist in MTGO format (e.g., "4 Lightning Bolt"). Include "Sideboard" on its own line to separate sideboard cards.
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={10}
          placeholder={`4 Lightning Bolt\n4 Counterspell\n2 Island\n\nSideboard\n2 Pyroblast`}
          value={decklist}
          onChange={(e) => setDecklist(e.target.value)}
          sx={{ mb: 2, fontFamily: 'monospace' }}
        />
        <Button variant="contained" onClick={handleCheck} disabled={loading || !decklist.trim()}>
          {loading ? 'Checking...' : 'Check Decklist'}
        </Button>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {result && (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Summary
            </Typography>
            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total Cards Needed
                </Typography>
                <Typography variant="h4">{result.total_cards_requested}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Cards Owned
                </Typography>
                <Typography variant="h4" color="success.main">
                  {result.total_cards_owned}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Cards Missing
                </Typography>
                <Typography variant="h4" color="error.main">
                  {result.total_cards_missing}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Completion
                </Typography>
                <Typography variant="h4">
                  {result.total_cards_requested > 0
                    ? Math.round((result.total_cards_owned / result.total_cards_requested) * 100)
                    : 0}
                  %
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Container selector for bulk move */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Move Cards To Container
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Select a target container, then click "Move" on any card location below to move cards there.
            </Typography>
            <Autocomplete
              options={flatContainers}
              getOptionLabel={(option) => option.path}
              value={targetContainer}
              onChange={(_, value) => setTargetContainer(value)}
              renderInput={(params) => (
                <TextField {...params} label="Target Container" placeholder="Select container..." />
              )}
              sx={{ maxWidth: 500 }}
            />
          </Paper>

          {mainDeck.length > 0 && renderCardTable(mainDeck, 'Main Deck')}
          
          {sideboard.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              {renderCardTable(sideboard, 'Sideboard')}
            </>
          )}
        </>
      )}

      {/* Move quantity dialog */}
      <Dialog open={moveDialogOpen} onClose={() => setMoveDialogOpen(false)}>
        <DialogTitle>Move Cards</DialogTitle>
        <DialogContent>
          {moveLocation && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" gutterBottom>
                Moving from: <strong>{moveLocation.container_path}</strong>
              </Typography>
              <Typography variant="body2" gutterBottom>
                To: <strong>{targetContainer?.path}</strong>
              </Typography>
              <Typography variant="body2" gutterBottom>
                Set: {moveLocation.set_code} #{moveLocation.card_number}
              </Typography>
              <Typography variant="body2" gutterBottom>
                Available: {moveLocation.quantity}
              </Typography>
              <TextField
                label="Quantity to move"
                type="number"
                value={moveQuantity}
                onChange={(e) => setMoveQuantity(Math.max(1, Math.min(moveLocation.quantity, parseInt(e.target.value) || 1)))}
                inputProps={{ min: 1, max: moveLocation.quantity }}
                fullWidth
                sx={{ mt: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleMoveConfirm}
            variant="contained"
            disabled={moveLoading || !moveLocation || moveQuantity < 1}
          >
            {moveLoading ? 'Moving...' : 'Move'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
