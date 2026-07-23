// ============================================================
// CONFIGURACIÓN DE STRIPE (CHECKOUT)
// ============================================================
//
// 1. Obtén tu clave publicable en:
//    https://dashboard.stripe.com/test/apikeys
//
// 2. Despliega la Edge Function de Supabase:
//    supabase secrets set STRIPE_SECRET_KEY=sk_test_...
//    supabase functions deploy create-checkout-session
//
// 3. Sustituye pk_test_... por tu clave publicable de prueba.
//    Cuando pases a producción, usa pk_live_...
// ============================================================

const STRIPE_PUBLISHABLE_KEY = "pk_live_51TsBeRFIiiltxvuOfgtLIO5vYnUZoc6xjxMCnL3jfXP6dd0mCf8c93keOLZviDyP9ruBLLTs1QeIbMvX7EYuDzTE00Dl7u1Q0q";

const CHECKOUT_FUNCTION_NAME = "create-checkout-session";

function isStripeConfigured() {
    return (
        typeof STRIPE_PUBLISHABLE_KEY === "string" &&
        STRIPE_PUBLISHABLE_KEY.startsWith("pk_") &&
        STRIPE_PUBLISHABLE_KEY !== "PON_AQUI_TU_PUBLISHABLE_KEY"
    );
}

function getCheckoutFunctionUrl() {
    if (!isSupabaseConfigured()) {
        return null;
    }

    return `${SUPABASE_URL}/functions/v1/${CHECKOUT_FUNCTION_NAME}`;
}
