// Puerto WhatsAppSender (T6.1, 03-08). Sin imports: mismo motivo que
// payment-gateway.ts -- tipo compartido entre apps/panel y
// supabase/functions (Deno) via ruta relativa.
export interface OutgoingMessage {
  to: string; // customer_phone en formato E.164
  body: string;
}

export interface WhatsAppCredentials {
  phoneNumberId: string;
  accessToken: string;
}

export interface SendResult {
  providerMessageId: string;
}

export interface IncomingMessage {
  providerMessageId: string; // messages[].id de Meta -- clave de idempotencia (FF-4)
  phoneNumberId: string; // para resolver tenant_id (03-08 §2.2)
  from: string; // customer_phone
  text: string;
}

/**
 * verifyWebhookSignature/parseIncoming no reciben credenciales por
 * tenant: la firma se valida con el app secret de la app de Meta
 * (unico, no por tenant -- 03-08 §2.1/§2.2), y el payload trae el
 * phone_number_id de cada mensaje para resolver el tenant despues.
 * sendMessage si recibe credenciales del tenant emisor.
 */
export interface WhatsAppSender {
  sendMessage(msg: OutgoingMessage, credentials: WhatsAppCredentials): Promise<SendResult>;
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null, appSecret: string): Promise<boolean>;
  parseIncoming(rawBody: string): IncomingMessage[];
}
