import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type ResolvedCartItem = {
  productId: number;
  name: string;
  price: number;
  quantity: number;
};

type CartQuantity = {
  productId: number;
  quantity: number;
};

export function getSupabaseAdmin(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase no está configurado en el servidor.");
  }

  return createClient(url, serviceRoleKey);
}

/** Solo acepta productId + quantity del cliente. Ignora precio y nombre. */
export function parseCartQuantities(items: unknown): CartQuantity[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("El carrito está vacío.");
  }

  if (items.length > 50) {
    throw new Error("Demasiados artículos en el carrito.");
  }

  return items.map((item) => {
    const productId = Number(item?.productId);
    const quantity = Number(item?.quantity ?? 1);

    if (!Number.isInteger(productId) || productId <= 0) {
      throw new Error("Identificador de producto no válido.");
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new Error("Cantidad no válida.");
    }

    return { productId, quantity };
  });
}

/** Resuelve nombre y precio reales desde la tabla productos. */
export async function resolveCartItems(
  supabase: SupabaseClient,
  items: CartQuantity[],
): Promise<ResolvedCartItem[]> {
  const uniqueIds = [...new Set(items.map((item) => item.productId))];

  const { data: products, error } = await supabase
    .from("productos")
    .select("id, nombre, precio, activo")
    .in("id", uniqueIds);

  if (error) {
    throw new Error("No se pudieron verificar los productos.");
  }

  const byId = new Map(
    (products ?? []).map((product) => [Number(product.id), product]),
  );

  return items.map((item) => {
    const product = byId.get(item.productId);

    if (!product || product.activo !== true) {
      throw new Error(
        `El producto #${item.productId} no está disponible.`,
      );
    }

    const price = Number(product.precio);

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(
        `El producto #${item.productId} tiene un precio no válido.`,
      );
    }

    return {
      productId: Number(product.id),
      name: String(product.nombre),
      price,
      quantity: item.quantity,
    };
  });
}
