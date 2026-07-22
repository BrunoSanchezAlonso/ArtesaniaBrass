import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { fulfillCheckoutSession } from "../_shared/orders.ts";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

// Deno/Supabase Edge no tiene crypto síncrono: hace falta SubtleCrypto + constructEventAsync.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Método no permitido", { status: 405 });
  }

  if (!stripeSecretKey || !webhookSecret) {
    return new Response("Stripe webhook no configurado", { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Firma ausente", { status: 400 });
  }

  // El body debe ser el texto crudo; no parsear JSON antes de verificar.
  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Firma inválida";
    console.error("Webhook signature error:", message);
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(
        `Webhook ${event.type} session=${session.id} payment_status=${session.payment_status}`,
      );
      await fulfillCheckoutSession(stripe, session.id);
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const sessions = await stripe.checkout.sessions.list({
        payment_intent: paymentIntent.id,
        limit: 1,
      });
      const session = sessions.data[0];
      if (session) {
        console.log(
          `Webhook payment_intent.succeeded → session=${session.id}`,
        );
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
