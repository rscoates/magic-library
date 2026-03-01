import { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  InputAdornment,
  IconButton,
  Collapse,
  Chip,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { collectionApi } from '../api';
import { getErrorMessage } from '../api/client';
import type { CollectionSummary } from '../types';

export default function SearchCollection() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CollectionSummary[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [includeSold, setIncludeSold] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const data = await collectionApi.search(query, includeSold);
      setResults(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getRarityColor = (rarity: string): 'default' | 'primary' | 'secondary' | 'warning' | 'error' => {
    switch (rarity.toLowerCase()) {
      case 'mythic':
        return 'error';
      case 'rare':
        return 'warning';
      case 'uncommon':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Search Your Collection
        </Typography>
        <TextField
          fullWidth
          placeholder="Search by card name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={handleSearch} disabled={loading}>
                  <SearchIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={includeSold}
              onChange={(e) => setIncludeSold(e.target.checked)}
              size="small"
            />
          }
          label="Include sold"
          sx={{ mt: 1 }}
        />
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {searched && results.length === 0 && !loading && (
        <Alert severity="info">No cards found matching "{query}"</Alert>
      )}

      {results.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={40} />
                <TableCell>Card Name</TableCell>
                <TableCell>Set</TableCell>
                <TableCell>Rarity</TableCell>
                <TableCell align="right">Total Owned</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((card) => {
                const key = `${card.set_code}-${card.card_number}`;
                const isExpanded = expandedRows.has(key);

                return (
                  <>
                    <TableRow
                      key={key}
                      hover
                      onClick={() => toggleRow(key)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <IconButton size="small">
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight="medium">{card.card_name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={card.set_code} size="small" />
                        <Typography variant="caption" sx={{ ml: 1 }}>
                          #{card.card_number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={card.rarity}
                          size="small"
                          color={getRarityColor(card.rarity)}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">{card.total_quantity}</Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow key={`${key}-details`}>
                      <TableCell colSpan={5} sx={{ py: 0 }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 2, pl: 6 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Locations:
                            </Typography>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Location</TableCell>
                                  <TableCell>Language</TableCell>
                                  <TableCell>Finish</TableCell>
                                  <TableCell align="right">Quantity</TableCell>
                                  <TableCell>Comments</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {card.locations.map((loc, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell>{loc.container_path}</TableCell>
                                    <TableCell>{loc.language_name}</TableCell>
                                    <TableCell>{loc.finish_name || 'Non-Foil'}</TableCell>
                                    <TableCell align="right">{loc.quantity}</TableCell>
                                    <TableCell>
                                      <Typography variant="caption" color="text.secondary">
                                        {loc.comments || '-'}
                                      </Typography>
                                    </TableCell>
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
      )}
    </Box>
  );
}
