import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Chip,
  Button,
  Tooltip,
  TextField,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as MoneyIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { pricingApi, containersApi } from '../api';
import { getErrorMessage } from '../api/client';
import type { TopCardsResponse, Container, PricedCard } from '../types';

// Build Scryfall image URL from set code and collector number
const getScryfallImageUrl = (setCode: string, cardNumber: string): string => {
  return `https://api.scryfall.com/cards/${encodeURIComponent(setCode.toLowerCase())}/${encodeURIComponent(cardNumber)}?format=image&version=small`;
};

function formatUsd(value: number | null): string {
  if (value === null) return '—';
  return `$${value.toFixed(2)}`;
}

// Flatten container tree into a list for the dropdown
function flattenContainers(containers: Container[], depth = 0): { id: number; name: string; depth: number }[] {
  const result: { id: number; name: string; depth: number }[] = [];
  for (const c of containers) {
    result.push({ id: c.id, name: c.name, depth });
    if (c.children?.length) {
      result.push(...flattenContainers(c.children, depth + 1));
    }
  }
  return result;
}

export default function CollectionValue() {
  const [data, setData] = useState<TopCardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [containers, setContainers] = useState<Container[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<number | ''>('');
  const [limit, setLimit] = useState(250);
  const [reloading, setReloading] = useState(false);
  const [filterText, setFilterText] = useState('');

  const loadContainers = useCallback(async () => {
    try {
      const data = await containersApi.list();
      setContainers(data);
    } catch {
      // Non-critical
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await pricingApi.getCollectionValue(
        selectedContainer === '' ? undefined : selectedContainer,
        limit,
      );
      setData(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedContainer, limit]);

  useEffect(() => {
    loadContainers();
  }, [loadContainers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReload = async () => {
    setReloading(true);
    try {
      const result = await pricingApi.reload();
      if (result.loaded) {
        loadData();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setReloading(false);
    }
  };

  const flatContainers = flattenContainers(containers);

  const filteredCards: PricedCard[] = data
    ? data.cards.filter((c) => {
        if (!filterText) return true;
        const q = filterText.toLowerCase();
        return (
          c.card_name.toLowerCase().includes(q) ||
          c.set_code.toLowerCase().includes(q) ||
          c.container_name.toLowerCase().includes(q)
        );
      })
    : [];

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Collection Value
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Controls */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Container</InputLabel>
          <Select
            value={selectedContainer}
            label="Container"
            onChange={(e) => setSelectedContainer(e.target.value as number | '')}
          >
            <MenuItem value="">All containers</MenuItem>
            {flatContainers.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {'  '.repeat(c.depth)}{c.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Top N</InputLabel>
          <Select
            value={limit}
            label="Top N"
            onChange={(e) => setLimit(e.target.value as number)}
          >
            <MenuItem value={50}>Top 50</MenuItem>
            <MenuItem value={100}>Top 100</MenuItem>
            <MenuItem value={250}>Top 250</MenuItem>
            <MenuItem value={500}>Top 500</MenuItem>
          </Select>
        </FormControl>

        <TextField
          size="small"
          label="Filter results"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          sx={{ minWidth: 180 }}
        />

        <Tooltip title="Reload pricing data from disk">
          <Button
            variant="outlined"
            size="small"
            startIcon={reloading ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={handleReload}
            disabled={reloading}
          >
            Reload Prices
          </Button>
        </Tooltip>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : data ? (
        <>
          {/* Summary cards */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <Card sx={{ minWidth: 180 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <MoneyIcon color="success" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Value
                  </Typography>
                </Box>
                <Typography variant="h4" color="success.main">
                  {formatUsd(data.summary.total_value)}
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ minWidth: 160 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <InventoryIcon color="primary" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Cards
                  </Typography>
                </Box>
                <Typography variant="h4">
                  {data.summary.total_cards.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {data.summary.total_unique.toLocaleString()} unique entries
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ minWidth: 160 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <TrendingUpIcon color="info" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Priced
                  </Typography>
                </Box>
                <Typography variant="h4">
                  {data.summary.priced_cards.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  of {data.summary.total_unique.toLocaleString()} entries
                </Typography>
              </CardContent>
            </Card>

            {data.summary.unpriced_cards > 0 && (
              <Card sx={{ minWidth: 160 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <WarningIcon color="warning" />
                    <Typography variant="subtitle2" color="text.secondary">
                      Unpriced
                    </Typography>
                  </Box>
                  <Typography variant="h4" color="warning.main">
                    {data.summary.unpriced_cards.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            )}

            {!data.summary.pricing_available && (
              <Alert severity="warning" sx={{ flex: 1 }}>
                Pricing data is not loaded. Click "Reload Prices" or place a Scryfall default-cards JSON in the data directory.
              </Alert>
            )}
          </Box>

          {/* Top cards table */}
          <Typography variant="h6" gutterBottom>
            Top {limit} Cards by Value
          </Typography>

          <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 400px)' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 50 }}>#</TableCell>
                  <TableCell sx={{ width: 50 }}></TableCell>
                  <TableCell>Card Name</TableCell>
                  <TableCell>Set</TableCell>
                  <TableCell>Number</TableCell>
                  <TableCell>Finish</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Unit Price</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Container</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCards.map((card, idx) => (
                  <TableRow key={card.entry_id} hover>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell sx={{ p: 0.5 }}>
                      <Tooltip
                        title={
                          <Box
                            component="img"
                            src={getScryfallImageUrl(card.set_code, card.card_number)}
                            alt={card.card_name}
                            sx={{ width: 250, borderRadius: 1 }}
                          />
                        }
                        placement="right"
                        arrow
                      >
                        <Box
                          component="img"
                          src={getScryfallImageUrl(card.set_code, card.card_number)}
                          alt=""
                          sx={{ width: 32, height: 45, objectFit: 'cover', borderRadius: 0.5 }}
                          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {card.card_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={card.set_code} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{card.card_number}</TableCell>
                    <TableCell>
                      {card.finish_name ? (
                        <Chip
                          label={card.finish_name}
                          size="small"
                          sx={{
                            bgcolor: card.finish_name.toLowerCase() === 'foil' ? 'gold' : 'silver',
                            color: 'black',
                            fontWeight: 'bold',
                            fontSize: '0.7rem',
                          }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">regular</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{card.quantity}</TableCell>
                    <TableCell align="right">{formatUsd(card.unit_price)}</TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        color={card.total_price && card.total_price >= 10 ? 'success.main' : 'text.primary'}
                      >
                        {formatUsd(card.total_price)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{card.container_name}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredCards.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        {filterText ? 'No cards match the filter.' : 'No priced cards found.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      ) : null}
    </Box>
  );
}
