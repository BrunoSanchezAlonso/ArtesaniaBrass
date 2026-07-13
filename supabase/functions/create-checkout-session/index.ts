import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type CartItem = {
  name: string;
  price: number;
  quantity: number;
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

function validateItems(items: unknown): CartItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("El carrito está vacío.");
  }

  if (items.length > 50) {
    throw new Error("Demasiados artículos en el carrito.");
  }

  return items.map((item) => {
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    const price = Number(item?.price);
    const quantity = Number(item?.quantity ?? 1);

    if (!name || name.length > 120) {
      throw new Error("Nombre de producto no válido.");
    }

    if (!Number.isFinite(price) || price <= 0 || price > 10000) {
      throw new Error("Precio no válido.");
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new Error("Cantidad no válida.");
    }

    return { name, price, quantity };
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
    return jsonResponse(
      { error: "Stripe no está configurado en el servidor." },
      500,
    );
  }

  try {
    const body = await req.json();
    const items = validateItems(body.items);

    const successUrl = typeof body.successUrl === "string"
      ? body.successUrl
      : "";
    const cancelUrl = typeof body.cancelUrl === "string" ? body.cancelUrl : "";

    if (!successUrl.startsWith("http") || !cancelUrl.startsWith("http")) {
      throw new Error("URLs de retorno no válidas.");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: items.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: "eur",
          unit_amount: Math.round(item.price * 100),
          product_data: {
            name: item.name,
          },
        },
      })),
      success_url: successUrl,
      cancel_url: cancelUrl,
      shipping_address_collection: {
        allowed_countries: ["ES", "PT", "FR", "DE", "IT", "AD"],
      },
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
