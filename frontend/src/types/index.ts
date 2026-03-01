// Card types
export interface Card {
  id: number;
  set_code: string;
  number: string;
  name: string;
  rarity: string;
}

// Container types
export interface ContainerType {
  id: number;
  name: string;
}

export interface Container {
  id: number;
  name: string;
  description: string | null;
  type_id: number;
  container_type: ContainerType;
  parent_id: number | null;
  depth: number;
  created_at: string;
  binder_columns: 2 | 3 | 4;
  binder_fill_row: boolean;
  is_sold: boolean;
  children: Container[];
}

export interface ContainerCreate {
  name: string;
  description?: string;
  type_id: number;
  parent_id?: number;
  binder_columns?: 2 | 3 | 4;
  binder_fill_row?: boolean;
  is_sold?: boolean;
}

// Collection types
export interface CollectionEntry {
  id: number;
  set_code: string;
  card_number: string;
  container_id: number;
  quantity: number;
  finish_id: number | null;
  finish_name: string | null;
  language_id: number;
  language_name: string;
  comments: string | null;
  card_name: string;
  container_name: string;
  position: number | null;
}

export interface CollectionEntryCreate {
  set_code: string;
  card_number: string;
  container_id: number;
  quantity: number;
  finish_id?: number;
  language_id: number;
  comments?: string;
  position?: number;
}

export interface CollectionLocation {
  container_id: number;
  container_name: string;
  container_path: string;
  quantity: number;
  finish_name: string | null;
  language_name: string;
  comments: string | null;
}

export interface CollectionSummary {
  set_code: string;
  card_number: string;
  card_name: string;
  rarity: string;
  total_quantity: number;
  locations: CollectionLocation[];
}

// Metadata types
export interface Language {
  id: number;
  code: string;
  name: string;
}

export interface Finish {
  id: number;
  name: string;
}

// Auth types
export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface AuthStatus {
  auth_enabled: boolean;
}

// Decklist types
export interface DecklistCardLocation {
  entry_id: number;
  set_code: string;
  card_number: string;
  container_name: string;
  container_path: string;
  quantity: number;
  finish_name: string | null;
  language_name: string;
}

// Move types
export interface MoveRequest {
  quantity: number;
  target_container_id: number;
}

export interface MoveResponse {
  success: boolean;
  message: string;
  source_remaining_quantity: number;
  target_new_quantity: number;
  target_container_path: string;
}

export interface DecklistCardResult {
  card_name: string;
  requested_quantity: number;
  owned_quantity: number;
  missing_quantity: number;
  locations: DecklistCardLocation[];
  is_sideboard: boolean;
}

export interface DecklistResult {
  cards: DecklistCardResult[];
  total_cards_requested: number;
  total_cards_owned: number;
  total_cards_missing: number;
}

// Binder types
export interface BinderSlot {
  position: number;
  entry_id: number | null;
  set_code: string | null;
  card_number: string | null;
  card_name: string | null;
  quantity: number;
  finish_name: string | null;
  language_name: string | null;
  is_empty: boolean;
  overflow_count?: number;  // For fill-row mode: remaining copies that didn't fit
}

export interface BinderPage {
  container_id: number;
  container_name: string;
  page: number;
  total_pages: number;
  slots: BinderSlot[];
  max_position: number;
  binder_columns: 2 | 3 | 4;
  binder_fill_row: boolean;
}

export interface PositionUpdate {
  entry_id: number;
  position: number | null;
}

// Position detail types (for showing all copies at a position)
export interface PositionEntry {
  entry_id: number;
  set_code: string;
  card_number: string;
  card_name: string;
  quantity: number;
  finish_name: string | null;
  language_name: string;
  release_date: string | null;
}

export interface PositionEntriesResponse {
  position: number;
  card_name: string;
  entries: PositionEntry[];
  total_quantity: number;
}

// Bulk import/export types
export type ImportFormat = 'auto' | 'mtggoldfish' | 'deckbox' | 'simple';
export type ExportFormat = 'mtggoldfish' | 'deckbox' | 'simple';

export interface ImportRequest {
  container_id: number;
  format: ImportFormat;
  csv_data: string;
}

export interface ImportResult {
  success: boolean;
  imported_count: number;
  skipped_count: number;
  error_count: number;
  errors: string[];
  warnings: string[];
}

export interface ExportRequest {
  container_id?: number;
  format: ExportFormat;
}

// Pricing types
export interface PricedCard {
  entry_id: number;
  card_name: string;
  set_code: string;
  card_number: string;
  finish_name: string | null;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  container_name: string;
  container_id: number;
}

export interface CollectionValueSummary {
  total_value: number;
  total_cards: number;
  total_unique: number;
  priced_cards: number;
  unpriced_cards: number;
  pricing_available: boolean;
}

export interface TopCardsResponse {
  summary: CollectionValueSummary;
  cards: PricedCard[];
}

export interface PricingStatusResponse {
  loaded: boolean;
  message: string;
}
