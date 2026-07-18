import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase no está configurado en el servidor.");
  }

  return createClient(url, serviceRoleKey);
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

    return {
      name,
      price,
      quantity,
      productId: Number.isInteger(productId) && productId > 0
        ? productId
        : undefined,
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

  try {
    const body = await req.json();
    const metodoPago = body.metodoPago === "bizum" || body.metodoPago === "transferencia"
      ? body.metodoPago
      : null;

    if (!metodoPago) {
      throw new Error("Método de pago no válido.");
    }

    const customerName = typeof body.customerName === "string"
      ? body.customerName.trim()
      : "";
    const customerEmail = typeof body.customerEmail === "string"
      ? body.customerEmail.trim().toLowerCase()
      : "";

    if (!customerName || customerName.length > 120) {
      throw new Error("Indica tu nombre.");
    }

    if (!customerEmail || !customerEmail.includes("@") || customerEmail.length > 200) {
      throw new Error("Indica un email válido.");
    }

    const items = validateItems(body.items);
    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const supabase = getSupabaseAdmin();
    const { data: insertedOrder, error: insertError } = await supabase
      .from("pedidos")
      .insert({
        stripe_session_id: null,
        customer_email: customerEmail,
        customer_name: customerName,
        shipping_address: null,
        total_amount: totalAmount,
        currency: "eur",
        status: "pendiente_pago",
        metodo_pago: metodoPago,
        pago_confirmado: false,
        email_enviado: false,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    const { error: itemsError } = await supabase
      .from("pedido_items")
      .insert(items.map((item) => ({
        pedido_id: insertedOrder.id,
        producto_id: item.productId ?? null,
        nombre: item.name,
        precio_unitario: item.price,
        cantidad: item.quantity,
      })));

    if (itemsError) {
      throw new Error(itemsError.message);
    }

    return jsonResponse({
      order: {
        id: insertedOrder.id,
        metodo_pago: metodoPago,
        total_amount: totalAmount,
        pago_confirmado: false,
      },
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "No se pudo registrar el pedido.";

    return jsonResponse({ error: message }, 400);
  }
});
