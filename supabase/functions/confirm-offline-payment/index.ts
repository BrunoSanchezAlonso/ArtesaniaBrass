import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { confirmManualPayment } from "../_shared/orders.ts";

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

async function assertStoreAdmin(authHeader: string | null) {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error("Supabase no está configurado en el servidor.");
  }

  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("No autorizado.");
  }

  const userClient = createClient(url, anonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();

  if (userError || !userData.user?.email) {
    throw new Error("No autorizado.");
  }

  const adminClient = createClient(url, serviceRoleKey);
  const { data: adminRow, error: adminError } = await adminClient
    .from("store_admins")
    .select("email")
    .ilike("email", userData.user.email)
    .maybeSingle();

  if (adminError || !adminRow) {
    throw new Error("No tienes permisos de administrador.");
  }

  return userData.user.email;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido." }, 405);
  }

  try {
    await assertStoreAdmin(req.headers.get("Authorization"));

    const body = await req.json();
    const orderId = Number(body.orderId);

    const order = await confirmManualPayment(orderId);

    return jsonResponse({
      order: {
        id: order.id,
        pago_confirmado: order.pago_confirmado,
        email_enviado: order.email_enviado,
        status: order.status,
      },
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "No se pudo confirmar el pago.";

    const status = message === "No autorizado." ||
        message === "No tienes permisos de administrador."
      ? 401
      : 400;

    return jsonResponse({ error: message }, status);
  }
});
