import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { fulfillCheckoutSession } from "../_shared/orders.ts";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Respaldo cuando el webhook de Stripe falla o Apple Pay no llega a success.html:
 * busca sesiones de Checkout recientes ya pagadas y las registra.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido." }, 405);
  }

  if (!stripeSecretKey) {
    return jsonResponse({ error: "Stripe no está configurado." }, 500);
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Solo sesiones recientes: evita resucitar pedidos borrados a propósito.
    const createdAfter = Math.floor(Date.now() / 1000) - 2 * 60 * 60;

    const sessions = await stripe.checkout.sessions.list({
      limit: 30,
      status: "complete",
      created: { gte: createdAfter },
    });

    const results: Array<{ sessionId: string; orderId: number | null; status: string }> = [];

    for (const session of sessions.data) {
      if (session.payment_status === "unpaid") {
        results.push({
          sessionId: session.id,
          orderId: null,
          status: "skipped_unpaid",
        });
        continue;
      }

      try {
        const order = await fulfillCheckoutSession(stripe, session.id);
        results.push({
          sessionId: session.id,
          orderId: order?.id ?? null,
          status: order ? "ok" : "unpaid_or_missing",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "error";
        console.error(`Reconcile failed for ${session.id}:`, message);
        results.push({
          sessionId: session.id,
          orderId: null,
          status: `error:${message}`,
        });
      }
    }

    const synced = results.filter((r) => r.status === "ok").length;

    return jsonResponse({
      synced,
      checked: results.length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "No se pudo sincronizar pedidos.";
    return jsonResponse({ error: message }, 400);
  }
});
