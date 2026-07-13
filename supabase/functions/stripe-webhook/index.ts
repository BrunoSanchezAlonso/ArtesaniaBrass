import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { fulfillCheckoutSession } from "../_shared/orders.ts";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Método no permitido", { status: 405 });
  }

  if (!stripeSecretKey || !webhookSecret) {
    return new Response("Stripe webhook no configurado", { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2023-10-16",
  });

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Firma ausente", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Firma inválida";
    console.error("Webhook signature error:", message);
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_status === "paid") {
        await fulfillCheckoutSession(stripe, session.id);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Error al procesar el webhook";
    console.error("Webhook handler error:", message);
    return new Response(message, { status: 500 });
  }
});
