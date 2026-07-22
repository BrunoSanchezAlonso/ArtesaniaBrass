import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  getSupabaseAdmin,
  parseCartQuantities,
  resolveCartItems,
} from "../_shared/cart.ts";

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

function isAllowedReturnUrl(url: string): boolean {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return false;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host === "localhost" || host === "127.0.0.1") {
      return true;
    }

    if (host.endsWith(".netlify.app")) {
      return true;
    }

    if (host === "artesaniabrass.es" || host.endsWith(".artesaniabrass.es")) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido." }, 405);
  }

  if (!stripeSecretKey) {
    return jsonResponse(
      { error: "Stripe no está configurado en el servidor." },
      500,
    );
  }

  try {
    const body = await req.json();
    const requestedItems = parseCartQuantities(body.items);
    const supabase = getSupabaseAdmin();
    const items = await resolveCartItems(supabase, requestedItems);

    const successUrl = typeof body.successUrl === "string"
      ? body.successUrl
      : "";
    const cancelUrl = typeof body.cancelUrl === "string" ? body.cancelUrl : "";

    if (!isAllowedReturnUrl(successUrl) || !isAllowedReturnUrl(cancelUrl)) {
      throw new Error("URLs de retorno no válidas.");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: items.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: "eur",
          unit_amount: Math.round(item.price * 100),
          product_data: {
            name: `#${item.productId} · ${item.name}`,
            metadata: { producto_id: String(item.productId) },
          },
        },
      })),
      success_url: successUrl,
      cancel_url: cancelUrl,
      shipping_address_collection: {
        allowed_countries: ["ES", "PT", "FR", "DE", "IT", "AD"],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: {
              amount: 0,
              currency: "eur",
            },
            display_name: "Envío gratis (territorio español, incluidas islas)",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 2 },
              maximum: { unit: "business_day", value: 5 },
            },
          },
        },
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: {
              amount: 500,
              currency: "eur",
            },
            display_name: "Envío fuera de España (5 €)",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 4 },
              maximum: { unit: "business_day", value: 10 },
            },
          },
        },
      ],
      phone_number_collection: {
        enabled: true,
      },
      locale: "es",
      metadata: {
        source: "artesanibrass-web",
      },
    });

    if (!session.url) {
      throw new Error("No se pudo crear la sesión de pago.");
    }

    return jsonResponse({ url: session.url });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Error al crear la sesión de pago.";

    return jsonResponse({ error: message }, 400);
  }
});
