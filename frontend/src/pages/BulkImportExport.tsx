import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Link,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { bulkApi, containersApi } from '../api';
import { getErrorMessage } from '../api/client';
import type { Container, ImportResult, ImportFormat, ExportFormat } from '../types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function BulkImportExport() {
  const [tab, setTab] = useState(0);
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Import state
  const [importContainerId, setImportContainerId] = useState<number | ''>('');
  const [importFormat, setImportFormat] = useState<ImportFormat>('auto');
  const [importCsv, setImportCsv] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Export state
  const [exportContainerId, setExportContainerId] = useState<number | ''>('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('simple');

  useEffect(() => {
    loadContainers();
  }, []);

  const loadContainers = async () => {
    try {
      const data = await containersApi.listAll();
      setContainers(data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleImport = async () => {
    if (!importContainerId || !importCsv.trim()) {
      setError('Please select a container and paste CSV data');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setImportResult(null);

    try {
      const result = await bulkApi.importCollection({
        container_id: importContainerId as number,
        format: importFormat,
        csv_data: importCsv,
      });
      setImportResult(result);
      if (result.success) {
        setSuccess(`Successfully imported ${result.imported_count} cards`);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const csvData = await bulkApi.exportCollection({
        container_id: exportContainerId ? (exportContainerId as number) : undefined,
        format: exportFormat,
      });

      // Download as file
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `collection_${exportFormat}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess('Export downloaded successfully');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setImportCsv(e.target?.result as string);
    };
    reader.readAsText(file);
  };

  const flattenContainers = (containers: Container[], depth = 0): Array<Container & { displayName: string }> => {
    const result: Array<Container & { displayName: string }> = [];
    for (const container of containers) {
      result.push({
        ...container,
        displayName: '  '.repeat(depth) + container.name,
      });
      if (container.children?.length) {
        result.push(...flattenContainers(container.children, depth + 1));
      }
    }
    return result;
  };

  const flatContainers = flattenContainers(containers);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Bulk Import / Export
      </Typography>

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

      <Paper sx={{ p: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab icon={<UploadIcon />} label="Import" />
          <Tab icon={<DownloadIcon />} label="Export" />
        </Tabs>

        {/* Import Tab */}
        <TabPanel value={tab} index={0}>
          <Typography variant="body2" color="text.secondary" paragraph>
            Import cards from CSV. Supported formats: MTGGoldfish, Deckbox, and Simple.
            See{' '}
            <Link href="https://www.mtggoldfish.com/help/import_formats" target="_blank" rel="noopener">
              MTGGoldfish format documentation
            </Link>{' '}
            for details.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Target Container</InputLabel>
              <Select
                value={importContainerId}
                label="Target Container"
                onChange={(e) => setImportContainerId(e.target.value as number)}
              >
                {flatContainers.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.displayName} ({c.container_type.name})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Format</InputLabel>
              <Select
                value={importFormat}
                label="Format"
                onChange={(e) => setImportFormat(e.target.value as ImportFormat)}
              >
                <MenuItem value="auto">Auto-detect</MenuItem>
                <MenuItem value="mtggoldfish">MTGGoldfish</MenuItem>
                <MenuItem value="deckbox">Deckbox</MenuItem>
                <MenuItem value="simple">Simple</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              component="label"
            >
              Upload CSV File
              <input
                type="file"
                accept=".csv,.txt"
                hidden
                onChange={handleFileUpload}
              />
            </Button>
          </Box>

          <TextField
            label="CSV Data"
            multiline
            rows={12}
            fullWidth
            value={importCsv}
            onChange={(e) => setImportCsv(e.target.value)}
            placeholder={`Paste CSV data here, or upload a file above.\n\nExample (Simple format):\nQuantity,Name,Set,Number,Foil,Language\n4,Lightning Bolt,M10,146,,English\n1,Snapcaster Mage,ISD,78,foil,English`}
            sx={{ mb: 2, fontFamily: 'monospace' }}
          />

          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} /> : <UploadIcon />}
            onClick={handleImport}
            disabled={loading || !importContainerId || !importCsv.trim()}
          >
            {loading ? 'Importing...' : 'Import Cards'}
          </Button>

          {importResult && (
            <Box sx={{ mt: 3 }}>
              <Alert severity={importResult.success ? 'success' : 'warning'} sx={{ mb: 2 }}>
                Imported: {importResult.imported_count} | Errors: {importResult.error_count}
              </Alert>

              {importResult.errors.length > 0 && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>
                      Errors ({importResult.errors.length})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TableContainer>
                      <Table size="small">
                        <TableBody>
                          {importResult.errors.map((err, i) => (
                            <TableRow key={i}>
                              <TableCell>{err}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              )}

              {importResult.warnings.length > 0 && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>
                      Warnings ({importResult.warnings.length})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TableContainer>
                      <Table size="small">
                        <TableBody>
                          {importResult.warnings.map((warn, i) => (
                            <TableRow key={i}>
                              <TableCell>{warn}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              )}
            </Box>
          )}

          {/* Format Examples */}
          <Accordion sx={{ mt: 3 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Supported Formats & Examples</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="subtitle2" gutterBottom>
                MTGGoldfish Format
              </Typography>
              <Typography variant="body2" component="pre" sx={{ bgcolor: 'grey.100', p: 1, mb: 2, overflow: 'auto' }}>
{`Card,Set ID,Set Name,Quantity,Foil,Variation
Aether Vial,MMA,Modern Masters,1,REGULAR,""
Snapcaster Mage,ISD,Innistrad,4,FOIL,""`}
              </Typography>

              <Typography variant="subtitle2" gutterBottom>
                Deckbox Format
              </Typography>
              <Typography variant="body2" component="pre" sx={{ bgcolor: 'grey.100', p: 1, mb: 2, overflow: 'auto' }}>
{`Count,Tradelist Count,Name,Edition,Card Number,Condition,Language,Foil
4,0,Angel of Serenity,RTR,1,Near Mint,English,
1,0,Snapcaster Mage,ISD,78,Near Mint,English,foil`}
              </Typography>

              <Typography variant="subtitle2" gutterBottom>
                Simple Format
              </Typography>
              <Typography variant="body2" component="pre" sx={{ bgcolor: 'grey.100', p: 1, overflow: 'auto' }}>
{`Quantity,Name,Set,Number,Foil,Language
4,Lightning Bolt,M10,146,,English
1,Snapcaster Mage,ISD,78,foil,English`}
              </Typography>
            </AccordionDetails>
          </Accordion>
        </TabPanel>

        {/* Export Tab */}
        <TabPanel value={tab} index={1}>
          <Typography variant="body2" color="text.secondary" paragraph>
            Export your collection to CSV format for backup or import into other tools.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Container</InputLabel>
              <Select
                value={exportContainerId}
                label="Container"
                onChange={(e) => setExportContainerId(e.target.value as number | '')}
              >
                <MenuItem value="">All Containers</MenuItem>
                {flatContainers.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.displayName} ({c.container_type.name})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Format</InputLabel>
              <Select
                value={exportFormat}
                label="Format"
                onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              >
                <MenuItem value="simple">Simple (Recommended)</MenuItem>
                <MenuItem value="mtggoldfish">MTGGoldfish</MenuItem>
                <MenuItem value="deckbox">Deckbox</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} /> : <DownloadIcon />}
            onClick={handleExport}
            disabled={loading}
          >
            {loading ? 'Exporting...' : 'Export to CSV'}
          </Button>

          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Format Details
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Format</TableCell>
                    <TableCell>Compatible With</TableCell>
                    <TableCell>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell><Chip label="Simple" size="small" /></TableCell>
                    <TableCell>Magic Library backup/restore</TableCell>
                    <TableCell>Includes container names for full backup</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><Chip label="MTGGoldfish" size="small" /></TableCell>
                    <TableCell>MTGGoldfish.com</TableCell>
                    <TableCell>Standard format for deck/collection sharing</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><Chip label="Deckbox" size="small" /></TableCell>
                    <TableCell>Deckbox.org</TableCell>
                    <TableCell>Includes language and condition fields</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </TabPanel>
      </Paper>
    </Box>
  );
}
