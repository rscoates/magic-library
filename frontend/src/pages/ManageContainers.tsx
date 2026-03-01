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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Chip,
  Tooltip,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  MenuBook as BinderIcon,
} from '@mui/icons-material';
import { containersApi } from '../api';
import { getErrorMessage } from '../api/client';
import type { Container, ContainerType, ContainerCreate } from '../types';
import BinderView from '../components/BinderView';

export default function ManageContainers() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [containerTypes, setContainerTypes] = useState<ContainerType[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);
  const [formData, setFormData] = useState<ContainerCreate>({
    name: '',
    description: '',
    type_id: 0,
    parent_id: undefined,
  });

  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

  // Binder view state
  const [binderViewOpen, setBinderViewOpen] = useState(false);
  const [selectedBinderContainer, setSelectedBinderContainer] = useState<Container | null>(null);

  const handleOpenBinderView = (container: Container) => {
    setSelectedBinderContainer(container);
    setBinderViewOpen(true);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [containersData, typesData] = await Promise.all([
        containersApi.listAll(),
        containersApi.listTypes(),
      ]);
      setContainers(containersData);
      setContainerTypes(typesData);
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

  const handleOpenDialog = (container?: Container) => {
    if (container) {
      setEditingContainer(container);
      setFormData({
        name: container.name,
        description: container.description || '',
        type_id: container.type_id,
        parent_id: container.parent_id || undefined,
        is_sold: container.is_sold,
      });
    } else {
      setEditingContainer(null);
      setFormData({
        name: '',
        description: '',
        type_id: containerTypes[0]?.id || 0,
        parent_id: undefined,
        is_sold: false,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingContainer(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingContainer) {
        await containersApi.update(editingContainer.id, formData);
        setSuccess('Container updated successfully');
      } else {
        await containersApi.create(formData);
        setSuccess('Container created successfully');
      }
      handleCloseDialog();
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this container? All cards in it will be removed.')) {
      return;
    }

    try {
      await containersApi.delete(id);
      setSuccess('Container deleted successfully');
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleCreateType = async () => {
    if (!newTypeName.trim()) return;

    try {
      await containersApi.createType(newTypeName.trim().toLowerCase());
      setSuccess('Container type created successfully');
      setTypeDialogOpen(false);
      setNewTypeName('');
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box>
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

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Containers</Typography>
          <Box>
            <Button
              startIcon={<AddIcon />}
              onClick={() => setTypeDialogOpen(true)}
              sx={{ mr: 1 }}
            >
              Add Type
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
              Add Container
            </Button>
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Container types: {containerTypes.map((t) => t.name).join(', ')}
        </Typography>

        {containers.length === 0 ? (
          <Typography color="text.secondary">
            No containers yet. Create one to start organizing your collection.
          </Typography>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Path</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell width={120}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {containers
                  .sort((a, b) => getContainerPath(a).localeCompare(getContainerPath(b)))
                  .map((container) => (
                    <TableRow key={container.id}>
                      <TableCell>
                        <Typography fontWeight="medium">{container.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={container.container_type.name} size="small" />
                        {container.is_sold && (
                          <Chip label="Sold" size="small" color="warning" sx={{ ml: 0.5 }} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {getContainerPath(container)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {container.description || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {container.container_type.name.toLowerCase() === 'file' && (
                          <Tooltip title="View as Binder">
                            <IconButton size="small" color="primary" onClick={() => handleOpenBinderView(container)}>
                              <BinderIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        <IconButton size="small" onClick={() => handleOpenDialog(container)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(container.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Create/Edit Container Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingContainer ? 'Edit Container' : 'Create Container'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            autoFocus
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Type</InputLabel>
            <Select
              value={formData.type_id}
              label="Type"
              onChange={(e) => setFormData({ ...formData, type_id: e.target.value as number })}
            >
              {containerTypes.map((type) => (
                <MenuItem key={type.id} value={type.id}>
                  {type.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Parent Container (optional)</InputLabel>
            <Select
              value={formData.parent_id || ''}
              label="Parent Container (optional)"
              onChange={(e) =>
                setFormData({
                  ...formData,
                  parent_id: e.target.value === '' ? undefined : (e.target.value as number),
                })
              }
            >
              <MenuItem value="">None (top level)</MenuItem>
              {containers
                .filter((c) => c.id !== editingContainer?.id && c.depth < 9)
                .map((container) => (
                  <MenuItem key={container.id} value={container.id}>
                    {getContainerPath(container)}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Description (optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
          <FormControlLabel
            control={
              <Switch
                checked={formData.is_sold || false}
                onChange={(e) => setFormData({ ...formData, is_sold: e.target.checked })}
              />
            }
            label="Sold container"
            sx={{ mt: 1 }}
          />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
            Cards in sold containers are excluded from searches, decklist checks, and value calculations by default.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!formData.name.trim()}>
            {editingContainer ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Type Dialog */}
      <Dialog open={typeDialogOpen} onClose={() => setTypeDialogOpen(false)}>
        <DialogTitle>Add Container Type</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Type Name"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            margin="normal"
            placeholder="e.g., binder, drawer"
            helperText="Enter a singular name (e.g., 'binder' not 'binders')"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTypeDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateType} disabled={!newTypeName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Binder View Dialog */}
      <Dialog 
        open={binderViewOpen} 
        onClose={() => setBinderViewOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { height: '90vh' } }}
      >
        <DialogContent sx={{ p: 2, height: '100%' }}>
          {selectedBinderContainer && (
            <BinderView
              containerId={selectedBinderContainer.id}
              containerName={selectedBinderContainer.name}
              onClose={() => setBinderViewOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
