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
  productId?: number;
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
    const productId = Number(item?.productId);

    if (!name || name.length > 120) {
      throw new Error("Nombre de producto no válido.");
    }

    if (!Number.isFinite(price) || price <= 0 || price > 10000) {
      throw new Error("Precio no válido.");
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new Error("Cantidad no válida.");
    }

    if (
      item?.productId !== undefined &&
      item?.productId !== null &&
      (!Number.isInteger(productId) || productId <= 0)
    ) {
      throw new Error("Identificador de producto no válido.");
    }

    return {
      name,
      price,
      quantity,
      productId: Number.isInteger(productId) && productId > 0 ? productId : undefined,
    };
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
            name: item.productId ? `#${item.productId} · ${item.name}` : item.name,
            metadata: item.productId
              ? { producto_id: String(item.productId) }
              : undefined,
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
