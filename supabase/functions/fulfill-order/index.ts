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
    const body = await req.json();
    const sessionId = typeof body.sessionId === "string"
      ? body.sessionId.trim()
      : "";

    if (!sessionId.startsWith("cs_")) {
      throw new Error("Identificador de sesión no válido.");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const order = await fulfillCheckoutSession(stripe, sessionId);

    if (!order) {
      return jsonResponse({ error: "El pago aún no está confirmado." }, 409);
    }

    return jsonResponse({ order });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "No se pudo registrar el pedido.";

    return jsonResponse({ error: message }, 400);
  }
});
