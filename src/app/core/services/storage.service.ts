import { Injectable, inject } from '@angular/core';
import { LoggerService } from './logger.service';
import { SqliteService } from './sqlite.service';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly logger = inject(LoggerService);
  private readonly sqlite = inject(SqliteService);

  /**
   * Guarda un objeto serializado en SQLite.
   */
  public setItem(key: string, value: any): void {
    try {
      const dataStr = JSON.stringify(value);
      this.sqlite.execute(
        `INSERT INTO kv_store (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
        [key, dataStr]
      );
      this.logger.log(`Storage: Datos guardados con éxito para llave [${key}] en SQLite.`);
    } catch (e) {
      this.logger.error(`Storage: Error al guardar datos para llave [${key}] en SQLite`, e);
    }
  }

  /**
   * Obtiene un objeto deserializado de SQLite.
   */
  public getItem<T>(key: string): T | null {
    try {
      const rows = this.sqlite.query(`SELECT data FROM kv_store WHERE id = ?`, [key]);
      if (rows.length === 0) return null;
      const dataStr = rows[0].data;
      if (!dataStr) return null;
      return JSON.parse(dataStr) as T;
    } catch (e) {
      this.logger.error(`Storage: Error al obtener datos para llave [${key}] en SQLite`, e);
      return null;
    }
  }

  /**
   * Elimina un registro por llave.
   */
  public removeItem(key: string): void {
    try {
      this.sqlite.execute(`DELETE FROM kv_store WHERE id = ?`, [key]);
      this.logger.log(`Storage: Registro eliminado para llave [${key}] en SQLite.`);
    } catch (e) {
      this.logger.error(`Storage: Error al eliminar datos para llave [${key}]`, e);
    }
  }

  /**
   * Limpia la base de datos (Ej. logout)
   */
  public clear(): void {
    try {
      this.sqlite.clearAll();
      this.logger.log('Storage: Base de datos local SQLite completamente purgada.');
    } catch (e) {
      this.logger.error('Storage: Error al limpiar SQLite', e);
    }
  }
}
