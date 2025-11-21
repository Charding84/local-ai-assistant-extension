import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type {
  Collection,
  Item,
  RewriteHistory,
  ActionGraph,
  PredictiveEntry,
  UndoStack,
  CacheEntry,
} from './models';

const DB_NAME = 'assistant_hub_v1';
const DB_VERSION = 1;

interface AssistantDB extends DBSchema {
  collections: {
    key: string;
    value: Collection;
    indexes: { createdAt: number };
  };
  items: {
    key: string;
    value: Item;
    indexes: {
      collectionId: string;
      sourceURL: string;
      tags: string;
      createdAt: number;
    };
  };
  rewriteHistory: {
    key: string;
    value: RewriteHistory;
    indexes: {
      site: string;
      createdAt: number;
    };
  };
  actionGraphs: {
    key: string;
    value: ActionGraph;
    indexes: { lastRunAt: number; pinned: boolean };
  };
  predictiveStore: {
    key: string;
    value: PredictiveEntry;
    indexes: {
      score: number;
      lastUsedAt: number;
    };
  };
  undoStack: {
    key: string;
    value: UndoStack;
  };
  cacheLRU: {
    key: string;
    value: CacheEntry;
    indexes: { lastAccessedAt: number };
  };
}

let dbInstance: IDBPDatabase<AssistantDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<AssistantDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<AssistantDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Collections store
      if (!db.objectStoreNames.contains('collections')) {
        const collectionStore = db.createObjectStore('collections', {
          keyPath: 'collectionId',
        });
        collectionStore.createIndex('createdAt', 'createdAt');
      }

      // Items store
      if (!db.objectStoreNames.contains('items')) {
        const itemStore = db.createObjectStore('items', { keyPath: 'itemId' });
        itemStore.createIndex('collectionId', 'collectionId');
        itemStore.createIndex('sourceURL', 'sourceURL');
        itemStore.createIndex('tags', 'tags', { multiEntry: true });
        itemStore.createIndex('createdAt', 'createdAt');
      }

      // Rewrite history store
      if (!db.objectStoreNames.contains('rewriteHistory')) {
        const rewriteStore = db.createObjectStore('rewriteHistory', {
          keyPath: 'rewriteId',
        });
        rewriteStore.createIndex('site', 'site');
        rewriteStore.createIndex('createdAt', 'createdAt');
      }

      // Action graphs store
      if (!db.objectStoreNames.contains('actionGraphs')) {
        const graphStore = db.createObjectStore('actionGraphs', {
          keyPath: 'graphId',
        });
        graphStore.createIndex('lastRunAt', 'lastRunAt');
        graphStore.createIndex('pinned', 'pinned');
      }

      // Predictive store
      if (!db.objectStoreNames.contains('predictiveStore')) {
        const predictiveStore = db.createObjectStore('predictiveStore', {
          keyPath: 'key',
        });
        predictiveStore.createIndex('score', 'score');
        predictiveStore.createIndex('lastUsedAt', 'lastUsedAt');
      }

      // Undo stack store
      if (!db.objectStoreNames.contains('undoStack')) {
        db.createObjectStore('undoStack', { keyPath: 'siteKey' });
      }

      // Cache LRU store
      if (!db.objectStoreNames.contains('cacheLRU')) {
        const cacheStore = db.createObjectStore('cacheLRU', {
          keyPath: 'cacheKey',
        });
        cacheStore.createIndex('lastAccessedAt', 'lastAccessedAt');
      }
    },
  });

  return dbInstance;
}

export async function closeDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
