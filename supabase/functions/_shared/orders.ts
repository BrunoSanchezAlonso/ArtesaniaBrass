import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type OrderItem = {
  nombre: string;
  precio_unitario: number;
  cantidad: number;
  producto_id?: number | null;
};

export type SavedOrder = {
  id: number;
  stripe_session_id: string;
  customer_email: string | null;
  customer_name: string | null;
  shipping_address: Record<string, unknown> | null;
  total_amount: number;
  currency: string;
  status: string;
  email_enviado?: boolean;
  created_at: string;
  pedido_items: OrderItem[];
};

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase no está configurado en el servidor.");
  }

  return createClient(url, serviceRoleKey);
}

function formatAddress(address: Stripe.Address | null | undefined) {
  if (!address) return null;

  return {
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    postal_code: address.postal_code,
    state: address.state,
    country: address.country,
  };
}

function formatAddressText(address: Record<string, unknown> | null) {
  if (!address) return "No indicada";

  const parts = [
    address.line1,
    address.line2,
    address.postal_code,
    address.city,
    address.state,
    address.country,
  ].filter(Boolean);

  return parts.join(", ");
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
}

function formatOrderItemLabel(item: OrderItem) {
  if (item.producto_id) {
    return `#${item.producto_id} · ${item.nombre}`;
  }

  return item.nombre;
}

function buildItemsHtml(items: OrderItem[]) {
  return items.map((item) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;">${formatOrderItemLabel(item)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center;">${item.cantidad}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${formatMoney(item.precio_unitario * item.cantidad, "eur")}</td>
    </tr>
  `).join("");
}

async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.log(`RESEND_API_KEY no configurada. Email omitido para ${to}`);
    return false;
  }

  const from = Deno.env.get("RESEND_FROM") ??
    "ArtesaniaBrass <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Error al enviar email:", errorText);
    return false;
  }

  return true;
}

async function sendOrderEmails(order: SavedOrder) {
  if (!order.customer_email || order.email_enviado) {
    return false;
  }

  const items = order.pedido_items ?? [];
  const itemsHtml = buildItemsHtml(items);
  const total = formatMoney(order.total_amount, order.currency);
  const address = formatAddressText(order.shipping_address);

  const customerHtml = `
    <div style="font-family:Arial,sans-serif;color:#2c2c2c;max-width:560px;">
      <h1 style="color:#8a5a44;">¡Gracias por tu compra!</h1>
      <p>Hola${order.customer_name ? ` ${order.customer_name}` : ""},</p>
      <p>Hemos recibido tu pedido en ArtesaniaBrass. Estos son los detalles:</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <thead>
          <tr>
            <th style="text-align:left;padding-bottom:8px;">Producto</th>
            <th style="text-align:center;padding-bottom:8px;">Cant.</th>
            <th style="text-align:right;padding-bottom:8px;">Importe</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <p><strong>Total:</strong> ${total}</p>
      <p><strong>Dirección de envío:</strong><br>${address}</p>
      <p>Prepararemos tu pedido con mucho cariño. Si tienes alguna duda, responde a este correo.</p>
      <p style="color:#666;">ArtesaniaBrass · Joyería artesanal</p>
    </div>
  `;

  const ownerEmail = Deno.env.get("STORE_OWNER_EMAIL") ?? "intentaloaki@gmail.com";
  const ownerHtml = `
    <div style="font-family:Arial,sans-serif;color:#2c2c2c;max-width:560px;">
      <h1 style="color:#8a5a44;">Nuevo pedido #${order.id}</h1>
      <p><strong>Cliente:</strong> ${order.customer_name ?? "Sin nombre"} (${order.customer_email})</p>
      <p><strong>Total:</strong> ${total}</p>
      <p><strong>Dirección de envío:</strong><br>${address}</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <thead>
          <tr>
            <th style="text-align:left;padding-bottom:8px;">Producto</th>
            <th style="text-align:center;padding-bottom:8px;">Cant.</th>
            <th style="text-align:right;padding-bottom:8px;">Importe</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <p>Pedido registrado desde Stripe session ${order.stripe_session_id}</p>
    </div>
  `;

  const customerSent = await sendEmail({
    to: order.customer_email,
    subject: "Confirmación de tu pedido · ArtesaniaBrass",
    html: customerHtml,
  });

  const ownerSent = await sendEmail({
    to: ownerEmail,
    subject: `Nuevo pedido #${order.id} · ArtesaniaBrass`,
    html: ownerHtml,
  });

  if (!customerSent) {
    console.log(
      `No se pudo enviar email al cliente (${order.customer_email}). En Resend de prueba solo se puede enviar al email verificado de tu cuenta.`,
    );
  }

  return customerSent || ownerSent;
}

function extractProductIdFromLineItem(item: Stripe.LineItem) {
  const product = item.price?.product;

  if (product && typeof product === "object" && "metadata" in product) {
    const parsedId = Number(product.metadata?.producto_id);

    if (Number.isInteger(parsedId) && parsedId > 0) {
      return parsedId;
    }
  }

  const description = item.description ?? "";
  const match = description.match(/^#(\d+)\s·\s/);

  if (match) {
    return Number(match[1]);
  }

  return null;
}

function extractProductNameFromLineItem(item: Stripe.LineItem) {
  const description = item.description ?? "Producto";
  return description.replace(/^#\d+\s·\s/, "");
}

export async function fulfillCheckoutSession(
  stripe: Stripe,
  sessionId: string,
): Promise<SavedOrder | null> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price.product"],
  });

  if (session.payment_status !== "paid") {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const { data: existingOrder } = await supabase
    .from("pedidos")
    .select("id, email_enviado")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  const lineItems = session.line_items?.data ?? [];
  const items: OrderItem[] = lineItems.map((item) => ({
    nombre: extractProductNameFromLineItem(item),
    precio_unitario: (item.price?.unit_amount ?? 0) / 100,
    cantidad: item.quantity ?? 1,
    producto_id: extractProductIdFromLineItem(item),
  }));

  const totalAmount = (session.amount_total ?? 0) / 100;
  const shippingAddress = formatAddress(
    session.shipping_details?.address ?? session.customer_details?.address,
  );

  const orderPayload = {
    stripe_session_id: session.id,
    stripe_payment_intent_id: typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null,
    customer_email: session.customer_details?.email ?? session.customer_email,
    customer_name: session.customer_details?.name ??
      session.shipping_details?.name ?? null,
    shipping_address: shippingAddress,
    total_amount: totalAmount,
    currency: session.currency ?? "eur",
    status: "pagado",
  };

  let pedidoId = existingOrder?.id;

  if (!pedidoId) {
    const { data: insertedOrder, error: insertError } = await supabase
      .from("pedidos")
      .insert(orderPayload)
      .select("id")
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    pedidoId = insertedOrder.id;

    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from("pedido_items")
        .insert(items.map((item) => ({
          pedido_id: pedidoId,
          producto_id: item.producto_id,
          nombre: item.nombre,
          precio_unitario: item.precio_unitario,
          cantidad: item.cantidad,
        })));

      if (itemsError) {
        throw new Error(itemsError.message);
      }
    }
  }

  const { data: order, error: orderError } = await supabase
    .from("pedidos")
    .select(`
      id,
      stripe_session_id,
      customer_email,
      customer_name,
      shipping_address,
      total_amount,
      currency,
      status,
      email_enviado,
      created_at,
      pedido_items (
        producto_id,
        nombre,
        precio_unitario,
        cantidad
      )
    `)
    .eq("id", pedidoId)
    .single();

  if (orderError || !order) {
    throw new Error(orderError?.message ?? "No se pudo recuperar el pedido.");
  }

  const savedOrder = order as SavedOrder & { email_enviado: boolean };

  if (!savedOrder.email_enviado) {
    const emailSent = await sendOrderEmails(savedOrder);

    if (emailSent) {
      await supabase
        .from("pedidos")
        .update({ email_enviado: true })
        .eq("id", savedOrder.id);
    }
  }

  return savedOrder;
}
