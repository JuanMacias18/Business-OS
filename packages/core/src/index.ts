import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

export type { Session, SupabaseClient };

/**
 * Cliente Supabase tipado para uso en apps/ (panel).
 * Recibe siempre la anon key: la clave de administración del backend nunca vive aquí (regla de oro #4, CLAUDE.md).
 */
export function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey);
}
