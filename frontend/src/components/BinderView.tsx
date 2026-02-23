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
} from '@mui/material';
import {
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { binderApi, collectionApi, containersApi } from '../api';
import { getErrorMessage } from '../api/client';
import type { BinderPage, BinderSlot } from '../types';

interface BinderViewProps {
  containerId: number;
  containerName: string;
  onClose?: () => void;
}

// Build Scryfall image URL from set code and collector number
const getScryfallImageUrl = (setCode: string, cardNumber: string): string => {
  // Scryfall uses lowercase set codes
  return `https://api.scryfall.com/cards/${setCode.toLowerCase()}/${cardNumber}?format=image&version=normal`;
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
  
  // Image loading states
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  // Settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsColumns, setSettingsColumns] = useState<3 | 4>(3);
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
      setSettingsColumns(data.binder_columns as 3 | 4);
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

  const handleSlotClick = (slot: BinderSlot) => {
    setSelectedSlot(slot);
    setEditPosition(slot.position.toString());
    setEditDialogOpen(true);
  };

  const handlePositionUpdate = async () => {
    if (!selectedSlot || !selectedSlot.entry_id) return;
    
    setEditLoading(true);
    try {
      const newPosition = editPosition.trim() ? parseInt(editPosition) : null;
      await collectionApi.update(selectedSlot.entry_id, { position: newPosition ?? undefined });
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

  const renderSlot = (slot: BinderSlot) => {
    const showCardBack = slot.is_empty || imageErrors.has(slot.position);
    const imageUrl = !slot.is_empty && slot.set_code && slot.card_number
      ? getScryfallImageUrl(slot.set_code, slot.card_number)
      : CARD_BACK_URL;

    return (
      <Box
        key={slot.position}
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
            gridTemplateRows: 'repeat(3, 1fr)',
            gap: 1.5,
            height: '100%',
            maxWidth: binderPage?.binder_columns === 4 ? 750 : 600,
            mx: 'auto',
          }}
        >
          {binderPage?.slots.map(renderSlot) || Array((binderPage?.binder_columns || 3) * 3).fill(null).map((_, i) => (
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
        <DialogTitle>Edit Card Position</DialogTitle>
        <DialogContent>
          {selectedSlot && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" gutterBottom>
                Card: <strong>{selectedSlot.card_name}</strong>
              </Typography>
              <Typography variant="body2" gutterBottom>
                Set: {selectedSlot.set_code} #{selectedSlot.card_number}
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
                helperText="Enter slot number (1-based) or leave empty to remove from binder"
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
                onChange={(e) => setSettingsColumns(e.target.value as 3 | 4)}
              >
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
