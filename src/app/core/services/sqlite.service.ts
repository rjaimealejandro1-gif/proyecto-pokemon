import { Injectable, signal, computed } from '@angular/core';
// @ts-ignore
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

const DB_NAME = 'tcg_offline_storage';
const STORE_NAME = 'sqlite_db';
const FILE_ID = 'db_file';

@Injectable({
  providedIn: 'root'
})
export class SqliteService {
  private SQL!: SqlJsStatic;
  private db: Database | null = null;
  private _isReady = signal<boolean>(false);
  
  public readonly isReady = computed(() => this._isReady());

  constructor() {}

  /**
   * Inicializa SQL.js, carga desde IndexedDB y asegura el esquema.
   * Retorna true cuando está listo.
   */
  public async bootDatabase(): Promise<boolean> {
    if (this._isReady()) return true;

    try {
      // 1. Inicializar WASM
      this.SQL = await initSqlJs({
        locateFile: (file: string) => `/assets/sqlite/${file}`
      });

      // 2. Intentar cargar desde IndexedDB
      const savedData = await this.loadFromIndexedDB();
      if (savedData) {
        console.log('[SQLiteService] Base de datos restaurada desde IndexedDB.');
        this.db = new this.SQL.Database(savedData);
      } else {
        console.log('[SQLiteService] Creando nueva base de datos.');
        this.db = new this.SQL.Database();
      }

      // 3. Ejecutar Migraciones Iniciales (Idempotentes)
      this.runMigrations();

      // Guardar el estado inicial por si era nueva
      if (!savedData) {
        await this.saveToIndexedDB();
      }

      this._isReady.set(true);
      return true;
    } catch (e) {
      console.error('[SQLiteService] Error crítico al inicializar base de datos offline:', e);
      return false;
    }
  }

  private runMigrations(): void {
    if (!this.db) return;
    const migrationSQL = `
      CREATE TABLE IF NOT EXISTS kv_store (
        id TEXT PRIMARY KEY,
        data TEXT
      );

      CREATE TABLE IF NOT EXISTS pokemon_cache (
        id TEXT PRIMARY KEY,
        json_data TEXT,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS local_matches (
        id TEXT PRIMARY KEY,
        mode TEXT,
        result TEXT,
        data TEXT,
        created_at INTEGER
      );
    `;
    this.db.run(migrationSQL);
  }

  /**
   * Ejecuta una consulta SQL y retorna los resultados (SELECT).
   */
  public query(sqlStr: string, params?: any[]): any[] {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(sqlStr);
    if (params) {
      stmt.bind(params);
    }
    
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  /**
   * Ejecuta comandos de escritura (INSERT, UPDATE, DELETE).
   * Llama automáticamente al guardado de IndexedDB (Fire and forget).
   */
  public execute(sqlStr: string, params?: any[]): void {
    if (!this.db) throw new Error('Database not initialized');
    if (params) {
      this.db.run(sqlStr, params);
    } else {
      this.db.run(sqlStr);
    }
    // Disparamos el volcado de memoria a persistencia en 2º plano
    this.saveToIndexedDB().catch(e => console.error('Error guardando en IDB', e));
  }

  /**
   * Cierra y limpia la base de datos (Ej: Logout forzado)
   */
  public clearAll(): void {
    if (this.db) {
      this.db.run('DELETE FROM kv_store; DELETE FROM pokemon_cache; DELETE FROM local_matches;');
      this.saveToIndexedDB();
    }
  }

  // ==========================================
  // Capa Física de Persistencia (IndexedDB)
  // ==========================================
  private openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (e: any) => {
        const idb = e.target.result as IDBDatabase;
        if (!idb.objectStoreNames.contains(STORE_NAME)) {
          idb.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e: any) => resolve(e.target.result);
      request.onerror = (e) => reject(e);
    });
  }

  private async loadFromIndexedDB(): Promise<Uint8Array | null> {
    const idb = await this.openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(FILE_ID);
      req.onsuccess = () => resolve(req.result ? (req.result as Uint8Array) : null);
      req.onerror = () => reject(req.error);
    });
  }

  private async saveToIndexedDB(): Promise<void> {
    if (!this.db) return;
    const data = this.db.export(); // Extrae Uint8Array
    const idb = await this.openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(data, FILE_ID);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}
