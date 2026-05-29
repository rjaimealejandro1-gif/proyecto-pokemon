#!/usr/bin/env node

/**
 * SUPABASE SCHEMA DISCOVERY SCRIPT
 * 
 * Descubre el esquema real de Supabase
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://klmngjtldhslatmqjcbf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_1LrwE8fOhYNdl-4pAtkZ_w_mo-PXcC5';

const styles = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const log = {
  title: (msg) => console.log(`\n${styles.bright}${styles.blue}▶ ${msg}${styles.reset}`),
  success: (msg) => console.log(`${styles.green}✓${styles.reset} ${msg}`),
  error: (msg) => console.log(`${styles.red}✗${styles.reset} ${msg}`),
  warn: (msg) => console.log(`${styles.yellow}⚠${styles.reset} ${msg}`),
  info: (msg) => console.log(`${styles.cyan}ℹ${styles.reset} ${msg}`),
  data: (msg) => console.log(`${styles.gray}${msg}${styles.reset}`),
};

async function main() {
  log.title('SUPABASE SCHEMA DISCOVERY');

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const tables = ['profiles', 'player_collection', 'decks', 'deck_cards'];

  for (const tableName of tables) {
    log.title(`TABLE: ${tableName}`);
    
    try {
      // Traer 1 registro para ver la estructura
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (error) {
        log.error(`Error: ${error.message}`);
        continue;
      }

      if (data && data.length > 0) {
        const row = data[0];
        log.success(`Ejemplo de registro:`);
        Object.keys(row).forEach(key => {
          log.data(`  ${key}: ${typeof row[key]} = ${JSON.stringify(row[key])}`);
        });
      } else {
        log.warn('Tabla vacía - mostrando estructura basada en definición');
        
        // Intentar insertar un registro de prueba para inferir esquema
        const { count, error: countError } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        log.info(`Total de registros: ${count || 0}`);
      }

    } catch (err) {
      log.error(`Excepción: ${err.message}`);
    }
  }

  // Información de Auth
  log.title('INFORMACIÓN DE AUTH');
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (user) {
      log.success(`Usuario autenticado: ${user.id}`);
      log.info(`Email: ${user.email}`);
      log.info(`Creado: ${user.created_at}`);
    } else {
      log.warn('No hay sesión de usuario - Esto es normal para client-side con publishable key');
      log.info('Se esperaría autenticación en contexto de navegador');
    }
  } catch (err) {
    log.error(`Error: ${err.message}`);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
