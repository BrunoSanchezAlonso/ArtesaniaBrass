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
  stripe_session_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  shipping_address: Record<string, unknown> | null;
  total_amount: number;
  currency: string;
  status: string;
  metodo_pago?: string;
  pago_confirmado?: boolean;
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

/** Wallets (Apple Pay / Google Pay) y APIs nuevas pueden traer el envío en sitios distintos. */
function getSessionShipping(session: Stripe.Checkout.Session) {
  const collected = (
    session as Stripe.Checkout.Session & {
      collected_information?: {
        shipping_details?: Stripe.Checkout.Session.ShippingDetails | null;
      };
    }
  ).collected_information?.shipping_details;

  const shipping = collected ?? session.shipping_details ?? null;

  return {
    name: shipping?.name ?? session.customer_details?.name ?? null,
    address: formatAddress(
      shipping?.address ?? session.customer_details?.address,
    ),
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatAddressText(address: Record<string, unknown> | null) {
  if (!address) return "No indicada";

  const parts = [
    address.line1,
    address.line2,
    [address.postal_code, address.city].filter(Boolean).join(" "),
    address.state,
    address.country,
  ].filter(Boolean);

  return parts.join(", ");
}

function formatAddressHtml(address: Record<string, unknown> | null) {
  if (!address) return "No indicada";

  const lines = [
    address.line1,
    address.line2,
    [address.postal_code, address.city].filter(Boolean).join(" "),
    address.state,
    address.country,
  ].filter(Boolean);

  return lines.map((line) => escapeHtml(line)).join("<br>");
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
      <td style="padding:12px 0;border-bottom:1px solid #eadfd3;color:#2c2c2c;">
        ${escapeHtml(formatOrderItemLabel(item))}
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid #eadfd3;text-align:center;color:#555;">
        ${item.cantidad}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #eadfd3;text-align:right;color:#2c2c2c;font-weight:bold;">
        ${escapeHtml(formatMoney(item.precio_unitario * item.cantidad, "eur"))}
      </td>
    </tr>
  `).join("");
}

function buildEmailShell({
  title,
  eyebrow,
  bodyHtml,
}: {
  title: string;
  eyebrow: string;
  bodyHtml: string;
}) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3ebe4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3ebe4;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e8dfd2;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#8a5a44;padding:22px 28px;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#fff;letter-spacing:0.02em;">
                ArtesaniaBrass
              </p>
              <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#f3ebe4;">
                Joyería artesanal en latón y cobre
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;color:#2c2c2c;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8a5a44;font-weight:bold;">
                ${escapeHtml(eyebrow)}
              </p>
              <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:#8a5a44;font-weight:normal;">
                ${escapeHtml(title)}
              </h1>
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #eadfd3;font-size:13px;line-height:1.6;color:#777;">
                ArtesaniaBrass · Rosa Alonso<br>
                <a href="mailto:info@artesaniabrass.es" style="color:#8a5a44;text-decoration:none;">info@artesaniabrass.es</a>
                ·
                <a href="https://www.instagram.com/artesania.brass/" style="color:#8a5a44;text-decoration:none;">@artesania.brass</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function buildOrderDetailsHtml(order: SavedOrder) {
  const items = order.pedido_items ?? [];
  const itemsHtml = buildItemsHtml(items);
  const total = formatMoney(order.total_amount, order.currency);
  const addressHtml = formatAddressHtml(order.shipping_address);
  const methodLabel = getMethodLabel(order.metodo_pago);

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;background:#faf7f2;border:1px solid #eadfd3;border-radius:12px;">
      <tr>
        <td style="padding:16px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#555;">
          <p style="margin:0 0 6px;"><strong style="color:#2c2c2c;">Pedido:</strong> #${order.id}</p>
          <p style="margin:0 0 6px;"><strong style="color:#2c2c2c;">Pago:</strong> ${escapeHtml(methodLabel)}</p>
          <p style="margin:0;"><strong style="color:#2c2c2c;">Total:</strong> ${escapeHtml(total)}</p>
        </td>
      </tr>
    </table>

    <h2 style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#8a5a44;">
      Resumen
    </h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;">
      <thead>
        <tr>
          <th align="left" style="padding:0 0 10px;border-bottom:2px solid #8a5a44;color:#8a5a44;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Producto</th>
          <th align="center" style="padding:0 8px 10px;border-bottom:2px solid #8a5a44;color:#8a5a44;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Cant.</th>
          <th align="right" style="padding:0 0 10px;border-bottom:2px solid #8a5a44;color:#8a5a44;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Importe</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <h2 style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#8a5a44;">
      Dirección de envío
    </h2>
    <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#555;">
      ${addressHtml}
    </p>
  `;
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
  const from = Deno.env.get("RESEND_FROM");
  const replyTo = Deno.env.get("RESEND_REPLY_TO") ||
    Deno.env.get("STORE_OWNER_EMAIL") ||
    "info@artesaniabrass.es";

  if (!apiKey) {
    console.log(`RESEND_API_KEY no configurada. Email omitido para ${to}`);
    return false;
  }

  if (!from) {
    console.error(
      "RESEND_FROM no configurado. Usa un email de tu dominio verificado, p. ej. ArtesaniaBrass <pedidos@tudominio.com>",
    );
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: replyTo,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Error al enviar email:", errorText);
    return false;
  }

  return true;
}

function getMethodLabel(metodoPago?: string) {
  if (metodoPago === "bizum") return "Bizum";
  if (metodoPago === "transferencia") return "transferencia";
  return "tarjeta";
}

function getOwnerEmail() {
  return Deno.env.get("STORE_OWNER_EMAIL") ?? "intentaloaki@gmail.com";
}

/** Aviso a la tienda: pedido nuevo (pendiente o ya pagado). */
export async function notifyOwnerNewOrder(order: SavedOrder) {
  const isPending = !order.pago_confirmado;
  const customerName = escapeHtml(order.customer_name ?? "Sin nombre");
  const customerEmail = escapeHtml(order.customer_email ?? "Sin email");

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#555;">
      ${
        isPending
          ? "Has recibido un pedido nuevo pendiente de pago. Cuando llegue el Bizum o la transferencia, confírmalo en el panel de administración."
          : "Has recibido un pedido nuevo con el pago ya confirmado."
      }
    </p>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#555;">
      <strong style="color:#2c2c2c;">Cliente:</strong> ${customerName}<br>
      <strong style="color:#2c2c2c;">Email:</strong> ${customerEmail}
    </p>
    ${
      isPending
        ? `<p style="margin:0 0 18px;padding:12px 14px;background:#fff7e8;border:1px solid #e8d3a8;border-radius:10px;font-size:14px;line-height:1.5;color:#6b4f1d;">
            Estado: <strong>pendiente de pago</strong>. Concepto esperado: #${customerName} Pedido #${order.id}
          </p>`
        : `<p style="margin:0 0 18px;padding:12px 14px;background:#eef6ea;border:1px solid #c9dfc0;border-radius:10px;font-size:14px;line-height:1.5;color:#2f5d2a;">
            Estado: <strong>pagado</strong>
          </p>`
    }
    ${buildOrderDetailsHtml(order)}
  `;

  const ownerHtml = buildEmailShell({
    title: `Pedido #${order.id}`,
    eyebrow: isPending ? "Nuevo pedido · Pendiente" : "Nuevo pedido · Pagado",
    bodyHtml,
  });

  return await sendEmail({
    to: getOwnerEmail(),
    subject: isPending
      ? `Nuevo pedido #${order.id} (pendiente de pago) · ArtesaniaBrass`
      : `Nuevo pedido #${order.id} · ArtesaniaBrass`,
    html: ownerHtml,
  });
}

/** Confirmación al cliente cuando el pago está confirmado. */
export async function notifyCustomerPaymentConfirmed(order: SavedOrder) {
  if (!order.customer_email || order.email_enviado) {
    return false;
  }

  const firstName = order.customer_name
    ? escapeHtml(String(order.customer_name).trim().split(/\s+/)[0])
    : "";

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#555;">
      Hola${firstName ? ` ${firstName}` : ""},
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#555;">
      Hemos confirmado el pago de tu pedido <strong>#${order.id}</strong>.
      Muy pronto prepararemos tus piezas con mimo en el taller.
    </p>
    ${buildOrderDetailsHtml(order)}
    <p style="margin:0;font-size:15px;line-height:1.6;color:#555;">
      Si tienes cualquier duda, escríbenos a
      <a href="mailto:info@artesaniabrass.es" style="color:#8a5a44;">info@artesaniabrass.es</a>.
    </p>
  `;

  const customerHtml = buildEmailShell({
    title: "¡Gracias por tu compra!",
    eyebrow: "Confirmación de pedido",
    bodyHtml,
  });

  const customerSent = await sendEmail({
    to: order.customer_email,
    subject: `Confirmación de tu pedido #${order.id} · ArtesaniaBrass`,
    html: customerHtml,
  });

  if (!customerSent) {
    console.log(
      `No se pudo enviar email al cliente (${order.customer_email}). Revisa RESEND_FROM y que el dominio esté verificado en Resend.`,
    );
  }

  return customerSent;
}

/** Stripe: aviso a la tienda + confirmación al cliente (pago ya hecho). */
async function sendPaidOrderEmails(order: SavedOrder) {
  if (order.email_enviado) {
    return false;
  }

  const ownerSent = await notifyOwnerNewOrder(order);
  const customerSent = await notifyCustomerPaymentConfirmed(order);

  return ownerSent || customerSent;
}

const ORDER_SELECT = `
  id,
  stripe_session_id,
  customer_email,
  customer_name,
  shipping_address,
  total_amount,
  currency,
  status,
  metodo_pago,
  pago_confirmado,
  email_enviado,
  created_at,
  pedido_items (
    producto_id,
    nombre,
    precio_unitario,
    cantidad
  )
`;

export async function confirmManualPayment(orderId: number): Promise<SavedOrder> {
  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw new Error("Identificador de pedido no válido.");
  }

  const supabase = getSupabaseAdmin();
  const { data: order, error } = await supabase
    .from("pedidos")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .single();

  if (error || !order) {
    throw new Error(error?.message ?? "Pedido no encontrado.");
  }

  const savedOrder = order as SavedOrder;

  if (
    savedOrder.metodo_pago !== "bizum" &&
    savedOrder.metodo_pago !== "transferencia"
  ) {
    throw new Error(
      "Solo se pueden confirmar manualmente pedidos por Bizum o transferencia.",
    );
  }

  if (!savedOrder.pago_confirmado) {
    const { error: updateError } = await supabase
      .from("pedidos")
      .update({
        pago_confirmado: true,
        status: "pagado",
      })
      .eq("id", orderId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    savedOrder.pago_confirmado = true;
    savedOrder.status = "pagado";
  }

  if (!savedOrder.email_enviado) {
    const emailSent = await notifyCustomerPaymentConfirmed(savedOrder);

    if (emailSent) {
      await supabase
        .from("pedidos")
        .update({ email_enviado: true })
        .eq("id", orderId);

      savedOrder.email_enviado = true;
    }
  }

  return savedOrder;
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
  // Expand mínimo recomendado por Stripe; los ítems se listan aparte por si hay muchos.
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items", "payment_intent"],
  });

  // paid | no_payment_required → cumplir; unpaid → aún no (métodos asíncronos / wallets).
  if (session.payment_status === "unpaid") {
    return null;
  }

  const supabase = getSupabaseAdmin();

  const { data: existingOrder } = await supabase
    .from("pedidos")
    .select("id, email_enviado")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  // Si ya se cumplió esta sesión y el pedido se borró, no recrear ni reenviar mails.
  const { data: processedSession, error: processedLookupError } = await supabase
    .from("stripe_checkout_sesiones")
    .select("session_id")
    .eq("session_id", session.id)
    .maybeSingle();

  if (processedLookupError) {
    console.error(
      "No se pudo consultar stripe_checkout_sesiones:",
      processedLookupError.message,
    );
  } else if (processedSession && !existingOrder) {
    console.log(
      `Sesión ${session.id} ya procesada y sin pedido: se omite (posible borrado manual).`,
    );
    return null;
  }

  const listedItems = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100,
    expand: ["data.price.product"],
  });
  const lineItems = listedItems.data.length > 0
    ? listedItems.data
    : session.line_items?.data ?? [];

  const items: OrderItem[] = lineItems.map((item) => ({
    nombre: extractProductNameFromLineItem(item),
    precio_unitario: (item.price?.unit_amount ?? 0) / 100,
    cantidad: item.quantity ?? 1,
    producto_id: extractProductIdFromLineItem(item),
  }));

  const shippingCostAmount = (session.shipping_cost?.amount_total ?? 0) / 100;
  if (shippingCostAmount > 0) {
    items.push({
      nombre: "Envío",
      precio_unitario: shippingCostAmount,
      cantidad: 1,
      producto_id: null,
    });
  }

  const totalAmount = (session.amount_total ?? 0) / 100;
  const shipping = getSessionShipping(session);

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;

  const orderPayload = {
    stripe_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    customer_email: session.customer_details?.email ?? session.customer_email,
    customer_name: shipping.name,
    shipping_address: shipping.address,
    total_amount: totalAmount,
    currency: session.currency ?? "eur",
    status: "pagado",
    metodo_pago: "tarjeta",
    pago_confirmado: true,
  };

  let pedidoId = existingOrder?.id;

  if (!pedidoId) {
    const { data: insertedOrder, error: insertError } = await supabase
      .from("pedidos")
      .insert(orderPayload)
      .select("id")
      .single();

    if (insertError) {
      // Carrera webhook + success.html: otra petición ya insertó el pedido.
      if (insertError.code === "23505") {
        const { data: racedOrder, error: racedError } = await supabase
          .from("pedidos")
          .select("id")
          .eq("stripe_session_id", session.id)
          .single();

        if (racedError || !racedOrder) {
          throw new Error(insertError.message);
        }

        pedidoId = racedOrder.id;
      } else {
        throw new Error(insertError.message);
      }
    } else {
      pedidoId = insertedOrder.id;

      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from("pedido_items")
          .insert(items.map((item) => ({
            pedido_id: pedidoId,
            producto_id: item.producto_id ?? null,
            nombre: item.nombre,
            precio_unitario: item.precio_unitario,
            cantidad: item.cantidad,
          })));

        if (itemsError) {
          throw new Error(itemsError.message);
        }
      }
    }
  }

  const { data: order, error: orderError } = await supabase
    .from("pedidos")
    .select(ORDER_SELECT)
    .eq("id", pedidoId)
    .single();

  if (orderError || !order) {
    throw new Error(orderError?.message ?? "No se pudo recuperar el pedido.");
  }

  const savedOrder = order as SavedOrder & { email_enviado: boolean };

  const { error: sessionTrackError } = await supabase
    .from("stripe_checkout_sesiones")
    .upsert(
      { session_id: session.id, pedido_id: savedOrder.id },
      { onConflict: "session_id" },
    );

  if (sessionTrackError) {
    console.error(
      "No se pudo registrar la sesión Stripe procesada:",
      sessionTrackError.message,
    );
  }

  if (!savedOrder.email_enviado) {
    // Reserva atómica: solo un fulfill concurrente (webhook + success + reconcile) envía mails.
    const { data: claimed, error: claimError } = await supabase
      .from("pedidos")
      .update({ email_enviado: true })
      .eq("id", savedOrder.id)
      .eq("email_enviado", false)
      .select("id")
      .maybeSingle();

    if (claimError) {
      console.error("No se pudo reservar el envío de email:", claimError.message);
    } else if (claimed) {
      try {
        const emailSent = await sendPaidOrderEmails({
          ...savedOrder,
          email_enviado: false,
        });

        if (!emailSent) {
          await supabase
            .from("pedidos")
            .update({ email_enviado: false })
            .eq("id", savedOrder.id);
        } else {
          savedOrder.email_enviado = true;
        }
      } catch (emailError) {
        await supabase
          .from("pedidos")
          .update({ email_enviado: false })
          .eq("id", savedOrder.id);

        console.error(
          "Pedido guardado, pero falló el envío de emails:",
          emailError instanceof Error ? emailError.message : emailError,
        );
      }
    }
  }

  return savedOrder;
}
