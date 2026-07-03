// ============================================================
// Capa de acceso a datos para el webhook de WhatsApp.
// Usa el cliente de Supabase con service_role (ignora RLS).
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ProductoCatalogo } from "./parser.ts";

export interface Tenant {
  id: string;
  nombre: string;
}

/** Resuelve el tenant a partir del phone_number_id de Meta. */
export async function getTenantByPhoneNumberId(
  supabase: SupabaseClient,
  phoneNumberId: string,
): Promise<Tenant | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select("id, nombre")
    .eq("whatsapp_phone_number_id", phoneNumberId)
    .eq("activo", true)
    .maybeSingle();

  if (error) {
    console.error("getTenantByPhoneNumberId error:", error.message);
    return null;
  }
  return data;
}

/** Catálogo activo del tenant para alimentar el parser. */
export async function getCatalogo(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<ProductoCatalogo[]> {
  const { data, error } = await supabase
    .from("productos")
    .select("nombre, precio, aliases")
    .eq("tenant_id", tenantId)
    .eq("activo", true);

  if (error) {
    console.error("getCatalogo error:", error.message);
    return [];
  }
  return (data ?? []).map((p) => ({
    nombre: p.nombre,
    precio: Number(p.precio),
    aliases: p.aliases ?? [],
  }));
}

/** Inserta el cliente si no existe; devuelve su id. */
export async function upsertCliente(
  supabase: SupabaseClient,
  tenantId: string,
  whatsappId: string,
  nombre: string | null,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("clientes")
    .upsert(
      { tenant_id: tenantId, whatsapp_id: whatsappId, nombre, telefono: whatsappId },
      { onConflict: "tenant_id,whatsapp_id", ignoreDuplicates: false },
    )
    .select("id")
    .single();

  if (error) {
    console.error("upsertCliente error:", error.message);
    return null;
  }
  return data.id;
}

/** Inserta un pedido y devuelve su id. */
export async function insertPedido(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    clienteId: string;
    total: number;
    detalles: unknown;
    mensajeOrigen: string;
  },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("pedidos")
    .insert({
      tenant_id: params.tenantId,
      cliente_id: params.clienteId,
      total: params.total,
      detalles_json: params.detalles,
      mensaje_origen: params.mensajeOrigen,
      estado: "recibido",
    })
    .select("id")
    .single();

  if (error) {
    console.error("insertPedido error:", error.message);
    return null;
  }
  return data.id;
}
