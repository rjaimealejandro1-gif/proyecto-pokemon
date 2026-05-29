export const environment = {
  production: false,
  // ── Supabase proyecto: proyecto3p (klmngjtldhslatmqjcbf) ──
  // NOTA: Se usa la legacy anon key (JWT) por compatibilidad con @supabase/supabase-js v2.x
  // La publishable key (sb_publishable_...) es para SDK v3+ y puede causar problemas
  // con persistSession y storageKey en v2. Ver: https://supabase.com/docs/reference/javascript
  supabaseUrl: 'https://klmngjtldhslatmqjcbf.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsbW5nanRsZGhzbGF0bXFqY2JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMjEzNTIsImV4cCI6MjA5NDc5NzM1Mn0.ngniitFEwt6TByudtetyceDMfxTRzpcF8bN6i-aKdug',
  pokeApiUrl: 'https://pokeapi.co/api/v2'
};
