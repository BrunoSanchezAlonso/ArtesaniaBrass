// ============================================================
// CONFIGURACIÓN DE SUPABASE
// Sustituye los valores de abajo por los de tu proyecto.
// Los encontrarás en: Supabase → Project Settings → API
// ============================================================

const SUPABASE_URL = "https://ejgbmquczzjqnidlkrwb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqZ2JtcXVjenpqcW5pZGxrcndiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzE2NjEsImV4cCI6MjA5OTM0NzY2MX0.UT6gCd3ltw8l1TmZ-vzHweeig8EX5HpxJnRo-2HIFpY";

function isSupabaseConfigured() {
    return (
        SUPABASE_URL !== "PON_AQUI_TU_PROJECT_URL" &&
        SUPABASE_ANON_KEY !== "PON_AQUI_TU_ANON_KEY" &&
        SUPABASE_URL.startsWith("https://") &&
        SUPABASE_ANON_KEY.length > 20
    );
}

const supabaseClient = isSupabaseConfigured()
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;
