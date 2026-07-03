# Configuración de Meta Cloud API (WhatsApp) — Guía esencial

Esta guía cubre los pasos para conectar tu Edge Function de Supabase con la
WhatsApp Cloud API de Meta.

## 1. Crear la app en Meta for Developers

1. Entra a https://developers.facebook.com/ → **My Apps** → **Create App**.
2. Tipo de app: **Business**.
3. En el panel de la app, añade el producto **WhatsApp**.
4. Meta te asigna automáticamente un **número de prueba** y un
   **Phone Number ID** (lo verás en *WhatsApp → API Setup*).

## 2. Credenciales que necesitas

| Credencial | Dónde se obtiene | Para qué sirve |
|------------|------------------|----------------|
| **App ID** | Configuración → Información básica | Identifica la app |
| **App Secret** | Configuración → Información básica | Verificar la firma `X-Hub-Signature-256` de cada webhook |
| **Phone Number ID** | WhatsApp → API Setup | Identifica el número del negocio (mapea a un *tenant*) |
| **Access Token** | WhatsApp → API Setup (temporal 24h) o System User (permanente) | Enviar mensajes de respuesta |
| **Verify Token** | **Lo inventas tú** (cualquier string secreto) | Verificar el webhook en el handshake inicial |

> ⚠️ El token temporal de la pantalla "API Setup" caduca en 24h. Para producción
> crea un **System User** en *Business Settings → Users → System Users* con permiso
> `whatsapp_business_messaging` y genera un token permanente.

## 3. Cómo funciona la verificación del webhook (GET)

Cuando registras la URL del webhook, Meta hace **un GET** a tu Edge Function con:

```
GET /functions/v1/whatsapp-webhook?hub.mode=subscribe
                                   &hub.verify_token=TU_VERIFY_TOKEN
                                   &hub.challenge=1234567890
```

Tu función debe:
1. Comprobar que `hub.mode === "subscribe"`.
2. Comprobar que `hub.verify_token` coincide con tu `WHATSAPP_VERIFY_TOKEN`.
3. Si todo cuadra, **devolver el valor de `hub.challenge` tal cual** con HTTP 200.
4. Si no, devolver 403.

Meta solo activa el webhook si recibe el challenge de vuelta correctamente.

## 4. Recepción de mensajes (POST)

Una vez verificado, cada mensaje entrante llega como **POST** con este shape:

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "metadata": { "phone_number_id": "1234567890" },
        "contacts": [{ "profile": { "name": "Juan" }, "wa_id": "573001112233" }],
        "messages": [{
          "from": "573001112233",
          "id": "wamid.XXX",
          "timestamp": "1719777600",
          "type": "text",
          "text": { "body": "Quiero 2 hamburguesas con extra queso y 1 Coca-Cola cero" }
        }]
      }
    }]
  }]
}
```

Reglas clave:
- **Siempre responde HTTP 200 rápido.** Si tardas o devuelves error, Meta reintenta
  el mismo mensaje varias veces (te puede llegar duplicado).
- `metadata.phone_number_id` → te dice **a qué negocio (tenant)** pertenece el mensaje.
- `messages[].from` → es el `whatsapp_id` del cliente.
- `contacts[].profile.name` → nombre del cliente (puede no venir).

## 5. Seguridad: firma X-Hub-Signature-256

Cada POST incluye la cabecera `X-Hub-Signature-256: sha256=<hmac>`. Es un HMAC-SHA256
del cuerpo crudo usando tu **App Secret** como clave. Verificarla evita que cualquiera
falsifique pedidos. La Edge Function lo valida si defines `META_APP_SECRET`.

## 6. Registrar el webhook en Meta

1. URL del webhook (Supabase):
   `https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook`
2. Verify Token: el mismo que pusiste en `WHATSAPP_VERIFY_TOKEN`.
3. Suscríbete al campo **`messages`**.

> La Edge Function debe ser pública (sin verificación JWT) para que Meta pueda llamarla.
> Ver comando de despliegue con `--no-verify-jwt` en el README del módulo.

## 7. Variables de entorno (secrets de Supabase)

```
WHATSAPP_VERIFY_TOKEN     # el string que inventaste
WHATSAPP_ACCESS_TOKEN     # token para responder mensajes
META_APP_SECRET           # para validar la firma (opcional pero recomendado)
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase automáticamente
en las Edge Functions.
