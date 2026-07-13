// Copia este archivo como supabase-config.js y rellena tus credenciales.
// Supabase → Project Settings → API

const SUPABASE_URL = "PON_AQUI_TU_PROJECT_URL";
const SUPABASE_ANON_KEY = "PON_AQUI_TU_ANON_KEY";

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
