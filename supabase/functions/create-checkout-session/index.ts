import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  fulfillCheckoutSession,
} from "../_shared/orders.ts";
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

    // IP local de la red (probar desde el móvil en la misma Wi‑Fi)
    if (
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)
    ) {
      return true;
    }

    // Túneles temporales para pruebas
    if (host.endsWith(".trycloudflare.com") || host.endsWith(".loca.lt")) {
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
    // "ES" = envío gratis solo a España; "INTL" = 5 € y solo países fuera de ES
    const shippingDestination = body.shippingDestination === "INTL"
      ? "INTL"
      : "ES";

    if (!isAllowedReturnUrl(successUrl) || !isAllowedReturnUrl(cancelUrl)) {
      throw new Error("URLs de retorno no válidas.");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Respaldo: sincroniza pagos recientes (p. ej. Apple Pay si el webhook falló).
    const reconcilePromise = (async () => {
      try {
        const recent = await stripe.checkout.sessions.list({
          limit: 15,
          status: "complete",
        });
        for (const recentSession of recent.data) {
          if (recentSession.payment_status === "unpaid") continue;
          try {
            await fulfillCheckoutSession(stripe, recentSession.id);
          } catch (reconcileError) {
            console.error(
              "Reconcile during checkout failed:",
              reconcileError instanceof Error
                ? reconcileError.message
                : reconcileError,
            );
          }
        }
      } catch (reconcileError) {
        console.error(
          "Could not list sessions for reconcile:",
          reconcileError instanceof Error
            ? reconcileError.message
            : reconcileError,
        );
      }
    })();

    // @ts-ignore EdgeRuntime exists on Supabase Edge
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(reconcilePromise);
    } else {
      // En local/tests, no bloqueamos la respuesta de checkout.
      reconcilePromise.catch(() => {});
    }

    const shipsToSpain = shippingDestination === "ES";
    const shippingOptions = shipsToSpain
      ? [
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
      ]
      : [
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
      ];

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
        allowed_countries: shipsToSpain
          ? ["ES"]
          : ["PT", "FR", "DE", "IT", "AD"],
      },
      shipping_options: shippingOptions,
      phone_number_collection: {
        enabled: true,
      },
      locale: "es",
      metadata: {
        source: "artesanibrass-web",
        shipping_destination: shippingDestination,
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
