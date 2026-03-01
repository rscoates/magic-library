import api from './client';
import type {
  Card,
  Container,
  ContainerType,
  ContainerCreate,
  CollectionEntry,
  CollectionEntryCreate,
  CollectionSummary,
  Language,
  Finish,
  DecklistResult,
  User,
  AuthStatus,
  TopCardsResponse,
  PricingStatusResponse,
} from '../types';

// Auth
export const authApi = {
  login: async (username: string, password: string): Promise<string> => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    const { data } = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data.access_token;
  },

  register: async (username: string, password: string): Promise<User> => {
    const { data } = await api.post('/auth/register', { username, password });
    return data;
  },

  getMe: async (): Promise<User> => {
    const { data } = await api.get('/auth/me');
    return data;
  },

  getStatus: async (): Promise<AuthStatus> => {
    const { data } = await api.get('/auth/status');
    return data;
  },
};

// Cards
export const cardsApi = {
  search: async (query: string, limit = 20): Promise<Card[]> => {
    const { data } = await api.get('/cards/search', { params: { q: query, limit } });
    return data;
  },

  getBySetNumber: async (setCode: string, number: string): Promise<Card> => {
    const { data } = await api.get(`/cards/by-set/${setCode}/${number}`);
    return data;
  },

  listSets: async (): Promise<string[]> => {
    const { data } = await api.get('/cards/sets');
    return data;
  },

  listNumbersInSet: async (setCode: string): Promise<string[]> => {
    const { data } = await api.get(`/cards/set/${setCode}/numbers`);
    return data;
  },
};

// Containers
export const containersApi = {
  listTypes: async (): Promise<ContainerType[]> => {
    const { data } = await api.get('/containers/types');
    return data;
  },

  createType: async (name: string): Promise<ContainerType> => {
    const { data } = await api.post('/containers/types', null, { params: { name } });
    return data;
  },

  list: async (parentId?: number): Promise<Container[]> => {
    const { data } = await api.get('/containers/', { params: { parent_id: parentId } });
    return data;
  },

  listAll: async (): Promise<Container[]> => {
    const { data } = await api.get('/containers/all');
    return data;
  },

  get: async (id: number): Promise<Container> => {
    const { data } = await api.get(`/containers/${id}`);
    return data;
  },

  create: async (container: ContainerCreate): Promise<Container> => {
    const { data } = await api.post('/containers/', container);
    return data;
  },

  update: async (id: number, container: Partial<ContainerCreate>): Promise<Container> => {
    const { data } = await api.put(`/containers/${id}`, container);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/containers/${id}`);
  },
};

// Collection
export const collectionApi = {
  add: async (entry: CollectionEntryCreate): Promise<CollectionEntry> => {
    const { data } = await api.post('/collection/', entry);
    return data;
  },

  list: async (containerId?: number): Promise<CollectionEntry[]> => {
    const { data } = await api.get('/collection/', { params: { container_id: containerId } });
    return data;
  },

  search: async (query: string): Promise<CollectionSummary[]> => {
    const { data } = await api.get('/collection/search', { params: { q: query } });
    return data;
  },

  update: async (id: number, entry: Partial<CollectionEntryCreate>): Promise<CollectionEntry> => {
    const { data } = await api.put(`/collection/${id}`, entry);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/collection/${id}`);
  },

  move: async (entryId: number, quantity: number, targetContainerId: number): Promise<import('../types').MoveResponse> => {
    const { data } = await api.post(`/collection/${entryId}/move`, {
      quantity,
      target_container_id: targetContainerId,
    });
    return data;
  },
};

// Metadata
export const metadataApi = {
  listLanguages: async (): Promise<Language[]> => {
    const { data } = await api.get('/metadata/languages');
    return data;
  },

  listFinishes: async (): Promise<Finish[]> => {
    const { data } = await api.get('/metadata/finishes');
    return data;
  },
};

// Decklist
export const decklistApi = {
  check: async (decklist: string): Promise<DecklistResult> => {
    const { data } = await api.post('/decklist/check', { decklist });
    return data;
  },
};

// Binder
export const binderApi = {
  getPage: async (containerId: number, page: number = 1): Promise<import('../types').BinderPage> => {
    const { data } = await api.get(`/collection/binder/${containerId}/page/${page}`);
    return data;
  },

  updatePositions: async (containerId: number, updates: import('../types').PositionUpdate[]): Promise<{ success: boolean; updated_count: number }> => {
    const { data } = await api.post(`/collection/binder/${containerId}/positions`, { updates });
    return data;
  },

  getEntriesAtPosition: async (containerId: number, position: number): Promise<import('../types').PositionEntriesResponse> => {
    const { data } = await api.get(`/collection/binder/${containerId}/position/${position}`);
    return data;
  },
};

// Bulk import/export
export const bulkApi = {
  importCollection: async (request: import('../types').ImportRequest): Promise<import('../types').ImportResult> => {
    const { data } = await api.post('/bulk/import', request);
    return data;
  },

  exportCollection: async (request: import('../types').ExportRequest): Promise<string> => {
    const { data } = await api.post('/bulk/export', request, {
      responseType: 'text',
    });
    return data;
  },

  getFormats: async (): Promise<{
    import_formats: Array<{ id: string; name: string; description: string; example?: string }>;
    export_formats: Array<{ id: string; name: string; description: string }>;
  }> => {
    const { data } = await api.get('/bulk/formats');
    return data;
  },
};

// Pricing
export const pricingApi = {
  getStatus: async (): Promise<PricingStatusResponse> => {
    const { data } = await api.get('/pricing/status');
    return data;
  },

  reload: async (): Promise<PricingStatusResponse> => {
    const { data } = await api.post('/pricing/reload');
    return data;
  },

  getCollectionValue: async (containerId?: number, limit = 250): Promise<TopCardsResponse> => {
    const { data } = await api.get('/pricing/collection', {
      params: { container_id: containerId, limit },
    });
    return data;
  },
};
