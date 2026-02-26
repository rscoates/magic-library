import { useState, useEffect, useCallback, TouchEvent } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Chip,
  Alert,
  Skeleton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from '@mui/material';
import {
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  LastPage,
} from '@mui/icons-material';
import { binderApi, containersApi } from '../api';
import { getErrorMessage } from '../api/client';
import type { BinderPage, BinderSlot, PositionEntriesResponse } from '../types';

interface BinderViewProps {
  containerId: number;
  containerName: string;
  onClose?: () => void;
}

// Build Scryfall image URL from set code and collector number
const getScryfallImageUrl = (setCode: string, cardNumber: string): string => {
  // Scryfall uses lowercase set codes and collector numbers must be URL-encoded
  return `https://api.scryfall.com/cards/${encodeURIComponent(setCode.toLowerCase())}/${encodeURIComponent(cardNumber)}?format=image&version=normal`;
};

// Card back placeholder
const CARD_BACK_URL = '/mtg-card-back.png';

export default function BinderView({ containerId, containerName, onClose }: BinderViewProps) {
  const [page, setPage] = useState(1);
  const [binderPage, setBinderPage] = useState<BinderPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Touch handling for swipe
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<BinderSlot | null>(null);
  const [editPosition, setEditPosition] = useState<string>('');
  const [editLoading, setEditLoading] = useState(false);
  
  // Detail dialog state (shows all copies/editions at a position)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [positionEntries, setPositionEntries] = useState<PositionEntriesResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Image loading states
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  // Settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsColumns, setSettingsColumns] = useState<2 | 3 | 4>(3);
  const [settingsFillRow, setSettingsFillRow] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const loadPage = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError('');
    try {
      const data = await binderApi.getPage(containerId, pageNum);
      setBinderPage(data);
      setPage(pageNum);
      setImageErrors(new Set());
      // Sync settings from response
      setSettingsColumns(data.binder_columns as 2 | 3 | 4);
      setSettingsFillRow(data.binder_fill_row);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [containerId]);

  const handleSaveSettings = async () => {
    setSettingsLoading(true);
    try {
      await containersApi.update(containerId, {
        binder_columns: settingsColumns,
        binder_fill_row: settingsFillRow,
      });
      setSettingsOpen(false);
      // Reload page 1 when settings change (especially columns changes page size)
      loadPage(1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  // Swipe detection
  const minSwipeDistance = 50;

  const onTouchStart = (e: TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && binderPage && page < binderPage.total_pages) {
      loadPage(page + 1);
    } else if (isRightSwipe && page > 1) {
      loadPage(page - 1);
    }
  };

  const handleSlotClick = async (slot: BinderSlot) => {
    setSelectedSlot(slot);
    setDetailLoading(true);
    setDetailDialogOpen(true);
    
    try {
      const entries = await binderApi.getEntriesAtPosition(containerId, slot.position);
      setPositionEntries(entries);
      setEditPosition(slot.position.toString());
    } catch (err) {
      setError(getErrorMessage(err));
      setDetailDialogOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenEditDialog = () => {
    setDetailDialogOpen(false);
    setEditDialogOpen(true);
  };

  const handlePositionUpdate = async () => {
    if (!selectedSlot || !positionEntries) return;
    
    setEditLoading(true);
    try {
      const newPosition = editPosition.trim() ? parseInt(editPosition) : null;
      // Update position for all entries at this position
      const updates = positionEntries.entries.map(entry => ({
        entry_id: entry.entry_id,
        position: newPosition,
      }));
      await binderApi.updatePositions(containerId, updates);
      setEditDialogOpen(false);
      loadPage(page);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setEditLoading(false);
    }
  };

  const handleImageError = (position: number) => {
    setImageErrors((prev) => new Set(prev).add(position));
  };

  const renderSlot = (slot: BinderSlot, index: number) => {
    const showCardBack = slot.is_empty || imageErrors.has(slot.position);
    const imageUrl = !slot.is_empty && slot.set_code && slot.card_number
      ? getScryfallImageUrl(slot.set_code, slot.card_number)
      : CARD_BACK_URL;

    return (
      <Box
        key={slot.entry_id ?? `empty-${index}`}
        sx={{
          position: 'relative',
          aspectRatio: '63/88',
          cursor: slot.is_empty ? 'default' : 'pointer',
          transition: 'transform 0.2s',
          '&:hover': slot.is_empty ? {} : {
            transform: 'scale(1.02)',
            zIndex: 1,
          },
        }}
        onClick={() => !slot.is_empty && handleSlotClick(slot)}
      >
        {loading ? (
          <Skeleton variant="rectangular" width="100%" height="100%" sx={{ borderRadius: 1 }} />
        ) : (
          <>
            <Box
              component="img"
              src={showCardBack ? CARD_BACK_URL : imageUrl}
              alt={slot.card_name || 'Empty slot'}
              onError={() => handleImageError(slot.position)}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: 1,
                boxShadow: slot.is_empty ? 'none' : 2,
                opacity: slot.is_empty ? 0.5 : 1,
              }}
            />
            
            {/* Position indicator */}
            <Chip
              label={slot.position}
              size="small"
              sx={{
                position: 'absolute',
                top: 4,
                left: 4,
                fontSize: '0.65rem',
                height: 18,
                minWidth: 24,
                bgcolor: 'rgba(0,0,0,0.6)',
                color: 'white',
              }}
            />
            
            {/* Quantity badge - shows quantity in badge mode, or overflow in fill-row mode */}
            {!slot.is_empty && (slot.quantity > 1 || (slot.overflow_count && slot.overflow_count > 0)) && (
              <Chip
                label={slot.overflow_count ? `+${slot.overflow_count}` : `×${slot.quantity}`}
                size="small"
                color={slot.overflow_count ? 'warning' : 'primary'}
                sx={{
                  position: 'absolute',
                  bottom: 4,
                  right: 4,
                  fontSize: '0.7rem',
                  height: 20,
                  fontWeight: 'bold',
                }}
              />
            )}
            
            {/* Foil indicator */}
            {!slot.is_empty && slot.finish_name && (
              <Chip
                label={slot.finish_name}
                size="small"
                sx={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  fontSize: '0.6rem',
                  height: 16,
                  bgcolor: 'gold',
                  color: 'black',
                }}
              />
            )}
            
            {/* Edit button on hover */}
            {!slot.is_empty && (
              <Tooltip title="Edit position">
                <IconButton
                  size="small"
                  sx={{
                    position: 'absolute',
                    bottom: 4,
                    left: 4,
                    bgcolor: 'rgba(255,255,255,0.8)',
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.95)' },
                    '.MuiBox-root:hover &': { opacity: 1 },
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">{containerName} - Binder View</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Binder settings">
            <IconButton onClick={() => setSettingsOpen(true)}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
          {onClose && (
            <Button onClick={onClose} variant="outlined" size="small">
              Close
            </Button>
          )}
        </Box>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {/* Binder page */}
      <Paper
        sx={{
          flex: 1,
          p: 2,
          bgcolor: 'grey.900',
          overflow: 'auto',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${binderPage?.binder_columns || 3}, 1fr)`,
            gridTemplateRows: `repeat(${binderPage?.binder_columns === 2 ? 2 : 3}, 1fr)`,
            gap: 1.5,
            height: '100%',
            maxWidth: binderPage?.binder_columns === 4 ? 750 : binderPage?.binder_columns === 2 ? 450 : 600,
            mx: 'auto',
          }}
        >
          {binderPage?.slots.map((slot, index) => renderSlot(slot, index)) || Array((binderPage?.binder_columns || 3) * (binderPage?.binder_columns === 2 ? 2 : 3)).fill(null).map((_, i) => (
            <Skeleton key={i} variant="rectangular" sx={{ aspectRatio: '63/88', borderRadius: 1 }} />
          ))}
        </Box>
      </Paper>
      
      {/* Navigation */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mt: 2 }}>
        <IconButton
          onClick={() => loadPage(page - 1)}
          disabled={loading || page <= 1}
        >
          <PrevIcon />
        </IconButton>
        
        <Typography>
          Page {page} of {binderPage?.total_pages || 1}
        </Typography>
        
        <IconButton
          onClick={() => loadPage(page + 1)}
          disabled={loading || !binderPage || page >= binderPage.total_pages}
        >
          <NextIcon />
        </IconButton>

        <IconButton
          onClick={() => loadPage(binderPage?.total_pages || page + 1)}
          disabled={loading || !binderPage || page >= binderPage.total_pages}
        >
          <LastPage />
        </IconButton>
        
        {/* Add page button */}
        <Tooltip title="Add new page">
          <IconButton
            onClick={() => {
              if (binderPage) {
                loadPage(binderPage.total_pages + 1);
              }
            }}
            disabled={loading}
          >
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Box>
      
      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Move Card to New Position</DialogTitle>
        <DialogContent>
          {selectedSlot && positionEntries && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" gutterBottom>
                Card: <strong>{positionEntries.card_name}</strong>
              </Typography>
              <Typography variant="body2" gutterBottom>
                {positionEntries.entries.length} edition(s), {positionEntries.total_quantity} total copies
              </Typography>
              <Typography variant="body2" gutterBottom>
                Current position: {selectedSlot.position}
              </Typography>
              <TextField
                label="New position"
                type="number"
                value={editPosition}
                onChange={(e) => setEditPosition(e.target.value)}
                fullWidth
                sx={{ mt: 2 }}
                helperText="All editions of this card will be moved to the new position"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handlePositionUpdate}
            variant="contained"
            disabled={editLoading}
          >
            {editLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail dialog - shows all copies/editions at a position */}
      <Dialog 
        open={detailDialogOpen} 
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {positionEntries?.card_name || selectedSlot?.card_name || 'Card Details'}
          <Typography variant="body2" color="text.secondary">
            Position {positionEntries?.position || selectedSlot?.position} • {positionEntries?.total_quantity || 0} total copies
          </Typography>
        </DialogTitle>
        <DialogContent>
          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : positionEntries && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Set</TableCell>
                    <TableCell>Number</TableCell>
                    <TableCell>Language</TableCell>
                    <TableCell>Finish</TableCell>
                    <TableCell>Qty</TableCell>
                    <TableCell>Release Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {positionEntries.entries.map((entry) => (
                    <TableRow key={entry.entry_id}>
                      <TableCell>{entry.set_code}</TableCell>
                      <TableCell>{entry.card_number}</TableCell>
                      <TableCell>{entry.language_name}</TableCell>
                      <TableCell>{entry.finish_name || '-'}</TableCell>
                      <TableCell>{entry.quantity}</TableCell>
                      <TableCell>{entry.release_date || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
          <Button onClick={handleOpenEditDialog} variant="outlined">
            Edit Position
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <DialogTitle>Binder Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, minWidth: 300 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Columns per row</InputLabel>
              <Select
                value={settingsColumns}
                label="Columns per row"
                onChange={(e) => setSettingsColumns(e.target.value as 2 | 3 | 4)}
              >
                <MenuItem value={2}>2 columns (2×2 = 4 slots/page)</MenuItem>
                <MenuItem value={3}>3 columns (3×3 = 9 slots/page)</MenuItem>
                <MenuItem value={4}>4 columns (4×3 = 12 slots/page)</MenuItem>
              </Select>
            </FormControl>
            
            <FormControlLabel
              control={
                <Switch
                  checked={settingsFillRow}
                  onChange={(e) => setSettingsFillRow(e.target.checked)}
                />
              }
              label="Fill row with copies"
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              When enabled, multiple copies of a card fill consecutive slots in the same row.
              Overflow shows a "+N" badge.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveSettings}
            variant="contained"
            disabled={settingsLoading}
          >
            {settingsLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
