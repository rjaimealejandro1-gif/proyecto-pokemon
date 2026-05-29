import { Card } from './card.model';
import { DeckStatus } from '../enums/deck-status.enum';

export interface Deck {
  id: string;
  name: string;
  userId: string;
  cards: Card[];
  createdAt?: string;
  // Campos de estado enterprise — opcionales para backward compatibility total
  status?: DeckStatus;         // Estado actual del mazo (calculado en runtime)
  loadError?: string;          // Mensaje de error si status === ERROR
  lastSyncedAt?: string;       // ISO timestamp de última sincronización exitosa con Supabase
  isSyncing?: boolean;         // true mientras una operación de sync está en curso
}

