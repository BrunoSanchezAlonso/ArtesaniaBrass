// Copia este archivo como stripe-config.js y rellena tu clave publicable.
// Stripe Dashboard → Developers → API keys

const STRIPE_PUBLISHABLE_KEY = "PON_AQUI_TU_PUBLISHABLE_KEY";

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
