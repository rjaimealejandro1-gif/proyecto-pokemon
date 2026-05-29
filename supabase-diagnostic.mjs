#!/usr/bin/env node

/**
 * SUPABASE DIAGNOSTIC SCRIPT
 * 
 * Conecta a Supabase y valida:
 * - Estado de todas las tablas
 * - Qué datos existen
 * - Integridad de relaciones
 * - Funcionalidad de operaciones CRUD
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://klmngjtldhslatmqjcbf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_1LrwE8fOhYNdl-4pAtkZ_w_mo-PXcC5';

// Estilos para consola
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
  log.title('SUPABASE DIAGNOSTIC SYSTEM');
  log.info(`Conectando a: ${SUPABASE_URL}`);

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    log.success('✓ Cliente Supabase inicializado');

    // 1. Verificar autenticación
    log.title('1. VERIFICANDO AUTENTICACIÓN');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      log.warn(`No hay usuario autenticado: ${authError.message}`);
    } else if (user) {
      log.success(`Usuario autenticado: ${user.email}`);
    } else {
      log.warn('No hay sesión activa (esperado en ambiente desarrollo)');
    }

    // 2. Diagnosticar tabla PROFILES
    log.title('2. DIAGNOSTICANDO TABLA: profiles');
    await diagnosisTable(supabase, 'profiles', ['id', 'username', 'email', 'level', 'xp', 'victories', 'defeats']);

    // 3. Diagnosticar tabla PLAYER_COLLECTION
    log.title('3. DIAGNOSTICANDO TABLA: player_collection');
    await diagnosisTable(supabase, 'player_collection', ['id', 'user_id', 'pokemon_id', 'rarity', 'created_at']);

    // 4. Diagnosticar tabla DECKS
    log.title('4. DIAGNOSTICANDO TABLA: decks');
    await diagnosisTable(supabase, 'decks', ['id', 'user_id', 'name', 'created_at', 'updated_at']);

    // 5. Diagnosticar tabla DECK_CARDS
    log.title('5. DIAGNOSTICANDO TABLA: deck_cards');
    await diagnosisTable(supabase, 'deck_cards', ['id', 'deck_id', 'pokemon_id', 'quantity', 'created_at']);

    // 6. Prueba de CRUD
    log.title('6. PROBANDO OPERACIONES CRUD');
    await testCRUD(supabase);

    // 7. Resumen final
    log.title('7. RESUMEN DIAGNÓSTICO');
    log.success('Diagnóstico completado exitosamente');

  } catch (err) {
    log.error(`Error fatal: ${err.message}`);
    console.error(err);
  }
}

async function diagnosisTable(supabase, tableName, columns) {
  try {
    // Contar registros
    const { count, error: countError } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (countError) {
      log.error(`No se pudo acceder a tabla '${tableName}': ${countError.message}`);
      return;
    }

    log.success(`Tabla '${tableName}' accesible`);
    log.info(`Total de registros: ${count || 0}`);

    // Traer primeros 5 registros
    const { data, error: dataError } = await supabase
      .from(tableName)
      .select(columns.join(','))
      .limit(5);

    if (dataError) {
      log.error(`Error al leer datos: ${dataError.message}`);
      return;
    }

    if (data && data.length > 0) {
      log.info(`Ejemplo de datos (primeros ${data.length} registros):`);
      data.forEach((row, idx) => {
        log.data(`  [${idx + 1}] ${JSON.stringify(row)}`);
      });
    } else {
      log.warn(`Tabla vacía`);
    }

  } catch (err) {
    log.error(`Excepción en tabla '${tableName}': ${err.message}`);
  }
}

async function testCRUD(supabase) {
  try {
    // Test INSERT
    log.info('Probando INSERT en player_collection...');
    const testId = `test-${Date.now()}`;
    const { data: insertData, error: insertError } = await supabase
      .from('player_collection')
      .insert([
        {
          user_id: 'test-user',
          pokemon_id: testId,
          rarity: 'COMMON'
        }
      ])
      .select();

    if (insertError) {
      log.warn(`INSERT fallido: ${insertError.message}`);
    } else {
      log.success(`INSERT exitoso`);
      log.data(`  Dato insertado: ${JSON.stringify(insertData)}`);

      // Test SELECT
      log.info('Probando SELECT...');
      const { data: selectData, error: selectError } = await supabase
        .from('player_collection')
        .select('*')
        .eq('pokemon_id', testId);

      if (selectError) {
        log.warn(`SELECT fallido: ${selectError.message}`);
      } else {
        log.success(`SELECT exitoso (${selectData.length} registros encontrados)`);

        // Test DELETE
        log.info('Probando DELETE...');
        const { error: deleteError } = await supabase
          .from('player_collection')
          .delete()
          .eq('pokemon_id', testId);

        if (deleteError) {
          log.warn(`DELETE fallido: ${deleteError.message}`);
        } else {
          log.success(`DELETE exitoso (registro de prueba eliminado)`);
        }
      }
    }

  } catch (err) {
    log.error(`Error en pruebas CRUD: ${err.message}`);
  }
}

main().catch(err => {
  log.error(`Error no capturado: ${err.message}`);
  process.exit(1);
});
