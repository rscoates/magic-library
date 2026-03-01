import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Skeleton,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { deckViewApi } from '../api';
import { getErrorMessage } from '../api/client';
import type { DeckViewResponse, DeckViewCard } from '../types';

interface DeckViewProps {
  containerId: number;
  containerName: string;
  onClose?: () => void;
}

// Build Scryfall image URL from set code and collector number
const getScryfallImageUrl = (setCode: string, cardNumber: string): string => {
  return `https://api.scryfall.com/cards/${encodeURIComponent(setCode.toLowerCase())}/${encodeURIComponent(cardNumber)}?format=image&version=normal`;
};

// Category colors for visual distinction
const CATEGORY_COLORS: Record<string, string> = {
  'Creatures': '#4caf50',
  'Instants & Sorceries': '#2196f3',
  'Other': '#ff9800',
  'Lands': '#8d6e63',
};

export default function DeckView({ containerId, containerName, onClose }: DeckViewProps) {
  const [deckData, setDeckData] = useState<DeckViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Card detail dialog
  const [selectedCard, setSelectedCard] = useState<DeckViewCard | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const loadDeck = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await deckViewApi.get(containerId);
      setDeckData(data);
      setImageErrors(new Set());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [containerId]);

  useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  const handleImageError = (key: string) => {
    setImageErrors((prev) => new Set(prev).add(key));
  };

  const handleCardClick = (card: DeckViewCard) => {
    setSelectedCard(card);
    setDetailOpen(true);
  };

  const renderCard = (card: DeckViewCard) => {
    const key = `${card.set_code}-${card.card_number}`;
    const hasError = imageErrors.has(key);
    const imageUrl = getScryfallImageUrl(card.set_code, card.card_number);

    return (
      <Box
        key={card.entry_id}
        sx={{
          position: 'relative',
          width: { xs: 100, sm: 130, md: 150 },
          flexShrink: 0,
          cursor: 'pointer',
          transition: 'transform 0.2s',
          '&:hover': {
            transform: 'scale(1.05)',
            zIndex: 1,
          },
        }}
        onClick={() => handleCardClick(card)}
      >
        {loading ? (
          <Skeleton
            variant="rectangular"
            sx={{ width: '100%', aspectRatio: '63/88', borderRadius: 1 }}
          />
        ) : (
          <>
            {hasError ? (
              <Box
                sx={{
                  width: '100%',
                  aspectRatio: '63/88',
                  borderRadius: 1,
                  bgcolor: 'grey.800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 1,
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  textAlign="center"
                  sx={{ fontSize: '0.6rem' }}
                >
                  {card.card_name}
                </Typography>
              </Box>
            ) : (
              <Tooltip title={`${card.card_name} (${card.set_code.toUpperCase()} #${card.card_number})`}>
                <Box
                  component="img"
                  src={imageUrl}
                  alt={card.card_name}
                  onError={() => handleImageError(key)}
                  sx={{
                    width: '100%',
                    aspectRatio: '63/88',
                    objectFit: 'cover',
                    borderRadius: 1,
                    boxShadow: 2,
                  }}
                />
              </Tooltip>
            )}

            {/* Quantity badge */}
            {card.quantity > 1 && (
              <Chip
                label={`×${card.quantity}`}
                size="small"
                color="primary"
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
            {card.finish_name && (
              <Chip
                label={card.finish_name}
                size="small"
                sx={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  fontSize: '0.55rem',
                  height: 16,
                  bgcolor: 'gold',
                  color: 'black',
                }}
              />
            )}

            {/* Mana value badge */}
            {card.mana_value != null && (
              <Chip
                label={Number.isInteger(card.mana_value) ? card.mana_value : card.mana_value.toFixed(1)}
                size="small"
                sx={{
                  position: 'absolute',
                  top: 4,
                  left: 4,
                  fontSize: '0.6rem',
                  height: 18,
                  minWidth: 24,
                  bgcolor: 'rgba(0,0,0,0.65)',
                  color: 'white',
                }}
              />
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
        <Box>
          <Typography variant="h6">{containerName} — Deck View</Typography>
          {deckData && (
            <Typography variant="body2" color="text.secondary">
              {deckData.total_cards} cards
            </Typography>
          )}
        </Box>
        {onClose && (
          <Button onClick={onClose} variant="outlined" size="small">
            Close
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Deck contents */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading && !deckData ? (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton
                key={i}
                variant="rectangular"
                sx={{ width: 130, aspectRatio: '63/88', borderRadius: 1 }}
              />
            ))}
          </Box>
        ) : deckData && deckData.categories.length === 0 ? (
          <Alert severity="info">No cards in this deck yet.</Alert>
        ) : (
          deckData?.categories.map((category) => (
            <Paper
              key={category.name}
              sx={{
                mb: 2,
                p: 2,
                bgcolor: 'grey.900',
                borderLeft: 4,
                borderColor: CATEGORY_COLORS[category.name] || 'grey.500',
              }}
            >
              {/* Category header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 'bold',
                    color: CATEGORY_COLORS[category.name] || 'text.primary',
                  }}
                >
                  {category.name}
                </Typography>
                <Chip
                  label={category.total_quantity}
                  size="small"
                  sx={{
                    bgcolor: CATEGORY_COLORS[category.name] || 'grey.500',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '0.75rem',
                  }}
                />
              </Box>

              {/* Cards row – scrollable on small screens */}
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                {category.cards.map((card) => renderCard(card))}
              </Box>
            </Paper>
          ))
        )}
      </Box>

      {/* Detail dialog */}
      <Dialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        {selectedCard && (
          <>
            <DialogTitle>{selectedCard.card_name}</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box
                  component="img"
                  src={getScryfallImageUrl(selectedCard.set_code, selectedCard.card_number)}
                  alt={selectedCard.card_name}
                  sx={{
                    width: '100%',
                    maxWidth: 300,
                    mx: 'auto',
                    borderRadius: 2,
                    boxShadow: 3,
                  }}
                />
                <Typography variant="body2">
                  <strong>Set:</strong> {selectedCard.set_code.toUpperCase()} #{selectedCard.card_number}
                </Typography>
                <Typography variant="body2">
                  <strong>Type:</strong> {selectedCard.type_line || 'Unknown'}
                </Typography>
                <Typography variant="body2">
                  <strong>Mana Value:</strong> {selectedCard.mana_value ?? 'N/A'}
                </Typography>
                <Typography variant="body2">
                  <strong>Quantity:</strong> {selectedCard.quantity}
                </Typography>
                <Typography variant="body2">
                  <strong>Language:</strong> {selectedCard.language_name}
                </Typography>
                {selectedCard.finish_name && (
                  <Typography variant="body2">
                    <strong>Finish:</strong> {selectedCard.finish_name}
                  </Typography>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetailOpen(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
