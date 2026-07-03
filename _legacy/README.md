# MiSaaSTech

Plataforma SaaS modular para automatizar negocios de comida.

## ¿Qué hace?

- **Asistente WhatsApp**: recibe y procesa pedidos automáticamente vía Meta Cloud API
- **Pagos con Nequi**: genera links de pago y confirma transacciones via webhook
- **Inventario automático**: descuenta ingredientes en tiempo real al confirmarse cada pedido
- **Dashboard de administración**: panel React con vista de pedidos, inventario y reportes

## Stack

| Capa | Tecnología |
|------|------------|
| Base de datos | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Backend serverless | Supabase Edge Functions (Deno) |
| Frontend | React + Vite |
| WhatsApp | Meta Cloud API |
| Pagos | Nequi API |

## Estructura del proyecto

```
MiSaaSTech/
├── core/                  # Lógica compartida entre módulos
├── whatsapp_assistant/    # Webhook y lógica del asistente de WhatsApp
├── payments_nequi/        # Integración de pagos Nequi
├── inventory_system/      # Sistema de inventario automático
├── admin_dashboard/       # Dashboard React para el cliente SaaS
├── supabase/              # Migraciones, seed y config de Supabase CLI
├── docs/                  # Documentación técnica
└── tests/                 # Pruebas de integración y unitarias
```

## Fases de desarrollo

- [x] Fase 0 — Preparación y estructura del proyecto
- [ ] Fase 1 — Supabase: base de datos y autenticación
- [ ] Fase 2 — Asistente WhatsApp (webhook + lógica de conversación)
- [ ] Fase 3 — Inventario automático
- [ ] Fase 4 — Integración Nequi
- [ ] Fase 5 — Dashboard de administración React

## Variables de entorno

Copia `.env.example` a `.env` en cada módulo y completa los valores reales.
