// IndexedDB schema types and helper functions

export interface Collection {
  collectionId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Item {
  itemId: string;
  collectionId: string;
  type: 'text' | 'highlight' | 'rewrite' | 'summary' | 'annotation';
  content: string;
  previewText: string;
  sourceURL: string;
  tags: string[];
  createdAt: number;
  meta: {
    provenance: 'local';
    [key: string]: unknown;
  };
}

export interface RewriteHistory {
  rewriteId: string;
  sourceText: string;
  resultText: string;
  settings: {
    length?: 'short' | 'medium' | 'long' | 'custom';
    tone?: string;
    style?: string;
    prompt?: string;
  };
  site: string;
  createdAt: number;
}

export interface ActionGraph {
  graphId: string;
  nodes: ActionNode[];
  edges: ActionEdge[];
  lastRunAt: number;
  pinned: boolean;
}

export interface ActionNode {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

export interface ActionEdge {
  from: string;
  to: string;
}

export interface PredictiveEntry {
  key: string;
  freq: number;
  lastUsedAt: number;
  score: number;
}

export interface UndoAction {
  actionType: string;
  timestamp: number;
  data: unknown;
}

export interface UndoStack {
  siteKey: string;
  actions: UndoAction[];
}

export interface CacheEntry {
  cacheKey: string;
  value: unknown;
  lastAccessedAt: number;
}

// LRU Cache helpers
export class LRUManager {
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  async evictOldest(db: IDBDatabase, storeName: string): Promise<void> {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const index = store.index('lastAccessedAt');
    const cursor = await index.openCursor();

    const entries: CacheEntry[] = [];
    let current = cursor;

    while (current) {
      entries.push(current.value);
      current = await current.continue();
    }

    if (entries.length > this.maxSize) {
      const toDelete = entries
        .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)
        .slice(0, entries.length - this.maxSize);

      for (const entry of toDelete) {
        await store.delete(entry.cacheKey);
      }
    }

    await tx.complete;
  }

  updateAccessTime(entry: CacheEntry): CacheEntry {
    return {
      ...entry,
      lastAccessedAt: Date.now(),
    };
  }
}

// Undo stack helpers
export class UndoStackManager {
  private maxActions: number;

  constructor(maxActions = 10) {
    this.maxActions = maxActions;
  }

  pushAction(stack: UndoStack, action: UndoAction): UndoStack {
    const actions = [action, ...stack.actions].slice(0, this.maxActions);
    return {
      ...stack,
      actions,
    };
  }

  popAction(stack: UndoStack): { stack: UndoStack; action: UndoAction | null } {
    if (stack.actions.length === 0) {
      return { stack, action: null };
    }

    const [action, ...rest] = stack.actions;
    return {
      stack: { ...stack, actions: rest },
      action,
    };
  }

  clear(stack: UndoStack): UndoStack {
    return {
      ...stack,
      actions: [],
    };
  }
}

// Helper to generate IDs
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper to create preview text
export function createPreview(text: string, maxLength = 150): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}
