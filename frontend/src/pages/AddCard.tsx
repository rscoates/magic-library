import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
} from '@mui/material';
import { cardsApi, containersApi, collectionApi, metadataApi } from '../api';
import { getErrorMessage } from '../api/client';
import type { Container, Language, Finish, Card as CardType } from '../types';

const steps = ['Select Container', 'Enter Card', 'Confirm & Add Details', 'Add to Collection'];

export default function AddCard() {
  const [activeStep, setActiveStep] = useState(0);
  const [containers, setContainers] = useState<Container[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [finishes, setFinishes] = useState<Finish[]>([]);
  const [sets, setSets] = useState<string[]>([]);
  
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [setCode, setSetCode] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [card, setCard] = useState<CardType | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [languageId, setLanguageId] = useState<number>(0);
  const [finishId, setFinishId] = useState<number | null>(null);
  const [comments, setComments] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [containersData, languagesData, finishesData, setsData] = await Promise.all([
        containersApi.listAll(),
        metadataApi.listLanguages(),
        metadataApi.listFinishes(),
        cardsApi.listSets(),
      ]);
      setContainers(containersData);
      setLanguages(languagesData);
      setFinishes(finishesData);
      setSets(setsData);
      
      // Set default language (English)
      const english = languagesData.find((l) => l.name === 'English');
      if (english) {
        setLanguageId(english.id);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const lookupCard = useCallback(async () => {
    if (!setCode || !cardNumber) return;
    
    setCardLoading(true);
    setCard(null);
    setError('');
    
    try {
      const cardData = await cardsApi.getBySetNumber(setCode, cardNumber);
      setCard(cardData);
      setActiveStep(2);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCardLoading(false);
    }
  }, [setCode, cardNumber]);

  const handleAddCard = async () => {
    if (!selectedContainer || !card || !languageId) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await collectionApi.add({
        set_code: card.set_code,
        card_number: card.number,
        container_id: selectedContainer.id,
        quantity,
        finish_id: finishId || undefined,
        language_id: languageId,
        comments: comments || undefined,
      });

      setSuccess(`Added ${quantity}x ${card.name} to ${selectedContainer.name}`);
      
      // Reset for next card but keep container selected
      setSetCode('');
      setCardNumber('');
      setCard(null);
      setQuantity(1);
      setFinishId(null);
      setComments('');
      // Reset language back to English for the next add
      const english = languages.find((l) => l.name.toLowerCase() === 'english');
      if (english) {
        setLanguageId(english.id);
      }
      setActiveStep(1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const getContainerPath = (container: Container): string => {
    const findPath = (id: number, path: string[] = []): string[] => {
      const c = containers.find((cont) => cont.id === id);
      if (!c) return path;
      if (c.parent_id) {
        return findPath(c.parent_id, [c.name, ...path]);
      }
      return [c.name, ...path];
    };
    return findPath(container.id).join(' > ');
  };

  return (
    <Box>
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        {/* Step 1: Select Container */}
        {activeStep === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Container
            </Typography>
            <Autocomplete
              options={containers}
              getOptionLabel={(option) => getContainerPath(option)}
              value={selectedContainer}
              onChange={(_, value) => {
                setSelectedContainer(value);
                if (value) setActiveStep(1);
              }}
              renderInput={(params) => (
                <TextField {...params} label="Container" placeholder="Search containers..." />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box>
                    <Typography>{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.container_type.name} - {getContainerPath(option)}
                    </Typography>
                  </Box>
                </li>
              )}
            />
          </Box>
        )}

        {/* Step 2: Enter Card */}
        {activeStep === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Enter Card Details
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Chip
                label={selectedContainer?.name}
                onDelete={() => setActiveStep(0)}
                color="primary"
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Autocomplete
                freeSolo
                options={sets}
                value={setCode}
                onChange={(_, value) => setSetCode(value || '')}
                onInputChange={(_, value) => setSetCode(value.toUpperCase())}
                sx={{ minWidth: 150 }}
                renderInput={(params) => (
                  <TextField {...params} label="Set Code" placeholder="e.g., MH2" />
                )}
              />
              <TextField
                label="Card Number"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="e.g., 42"
                sx={{ minWidth: 120 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    lookupCard();
                  }
                }}
              />
              <Button
                variant="contained"
                onClick={lookupCard}
                disabled={!setCode || !cardNumber || cardLoading}
              >
                {cardLoading ? 'Looking up...' : 'Look Up Card'}
              </Button>
            </Box>
          </Box>
        )}

        {/* Step 3: Confirm & Add Details */}
        {activeStep === 2 && card && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Confirm Card & Add Details
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Chip
                label={selectedContainer?.name}
                onDelete={() => setActiveStep(0)}
                color="primary"
                sx={{ mr: 1 }}
              />
              <Chip
                label={`${card.set_code} #${card.number}`}
                onDelete={() => {
                  setCard(null);
                  setActiveStep(1);
                }}
                color="secondary"
              />
            </Box>

            <Card sx={{ mb: 3, bgcolor: 'background.default' }}>
              <CardContent>
                <Typography variant="h5">{card.name}</Typography>
                <Typography color="text.secondary">
                  {card.set_code} #{card.number} - {card.rarity}
                </Typography>
              </CardContent>
            </Card>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
              <TextField
                type="number"
                label="Quantity"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                inputProps={{ min: 1 }}
                sx={{ width: 100 }}
              />

              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Language</InputLabel>
                <Select
                  value={languageId}
                  label="Language"
                  onChange={(e) => setLanguageId(e.target.value as number)}
                >
                  {languages.map((lang) => (
                    <MenuItem key={lang.id} value={lang.id}>
                      {lang.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Finish</InputLabel>
                <Select
                  value={finishId ?? ''}
                  label="Finish"
                  onChange={(e) => setFinishId(e.target.value === '' ? null : (e.target.value as number))}
                >
                  <MenuItem value="">Non-Foil</MenuItem>
                  {finishes.map((finish) => (
                    <MenuItem key={finish.id} value={finish.id}>
                      {finish.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <TextField
              fullWidth
              label="Comments (optional)"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              multiline
              rows={2}
              sx={{ mb: 3 }}
            />

            <Button
              variant="contained"
              onClick={handleAddCard}
              disabled={loading}
              size="large"
            >
              {loading ? 'Adding...' : 'Add to Collection'}
            </Button>
          </Box>
        )}

        {/* Step 4: Success - auto-reset handled */}
        {activeStep === 3 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Card Added Successfully
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
