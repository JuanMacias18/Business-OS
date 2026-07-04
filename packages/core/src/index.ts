import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

export type { Session, SupabaseClient };
export type {
  PaymentGateway,
  PaymentGatewayCredentials,
  PaymentStatus,
  CheckoutData,
  TransactionStatus,
  WebhookEvent,
} from "./payment-gateway";
export type {
  WhatsAppSender,
  WhatsAppCredentials,
  OutgoingMessage,
  IncomingMessage,
  SendResult,
} from "./whatsapp-sender";

/**
 * Cliente Supabase tipado para uso en apps/ (panel).
 * Recibe siempre la anon key: la clave de administración del backend nunca vive aquí (regla de oro #4, CLAUDE.md).
 */
export function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey);
}
