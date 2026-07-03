# Auditoría — Documentación MysaasTech (Business OS)

| Metadato | Valor |
|---|---|
| Fecha | 2026-07-02 |
| Alcance auditado | `00-INDEX.md` v2.0.0 · `01-01-vision-y-alcance.md` v1.0.0 (únicos documentos existentes) |
| Método | Impacto × probabilidad × costo de arreglo; se distingue "arreglar ya" / "vigilar" / "deuda tolerable" |
| Resultado | **Base sólida con un defecto de proceso crítico y 7 hallazgos accionables.** Parches listos para aplicar en §5. |

---

## 1. Veredicto

La calidad *intrínseca* de lo escrito es alta: la separación arquitectura plataforma-ready vs. producto v1 estrecho (ADR-011) es la decisión correcta, los no-objetivos blindan el alcance, el principio "el núcleo es agnóstico al flujo" es una costura sofisticada y barata, y las intuiciones técnicas embebidas (reserva de stock en solicitud, `getstatus` como verdad, decremento atómico, n8n fuera de la ruta crítica) son las correctas para este dominio.

El problema no está en el contenido sino en el **proceso de entrega que el propio índice impone**: 33 documentos + 11 ADR + 3 auditorías *antes* de escribir código. Ese plan reintroduce, en el plano documental, exactamente el riesgo que ADR-011 elimina en el plano de producto: **no lanzar nunca**. Para un equipo de una persona + Claude Code, el documento es un medio de validación, no el producto. La corrección no es escribir menos documentación — es reordenarla: mínima viable primero, just-in-time por hito después, con el código validando cada decisión mientras aún es barata de cambiar.

---

## 2. Fortalezas (no tocar)

1. **ADR-011 y su racional.** "Las plataformas se extraen de un vertical validado" — correcto y bien argumentado. Es el ancla estratégica del proyecto.
2. **Orden de prioridad explícito entre principios** (§1 del índice). Rarísimo verlo escrito; resuelve discusiones futuras por adelantado.
3. **No-objetivos de v1 y permanentes** (01-01 §6.2/6.3), especialmente el no-agregador ante Superfinanciera como restricción de diseño, no de fase.
4. **Núcleo agnóstico al flujo** (01-01 §5): "Pedidos" como módulo, no como concepto del core, con la familia agenda/reserva ya identificada. Costura barata hoy, cara de retrofitear.
5. **Cadena de trazabilidad** (índice §5) y ciclo de vida de documentos (§3.2): disciplina de docs-as-code real.
6. **Riesgos con mitigación asignada** (01-01 §13), con fuga cross-tenant correctamente como amenaza #1.
7. **Diseño para el fallo declarado** (timeouts, reintentos idempotentes, degradación) antes de escribir una línea.
8. **El pivote v1→v2 (instancia aislada por cliente → multi-tenant RLS) es correcto** para tus restricciones. Validación honesta en §6 de este informe.

---

## 3. Hallazgos críticos (arreglar ya)

### C1 — El plan documental es un waterfall que contradice ADR-011
**Evidencia:** índice §6 ("Con los 33 documentos y los 11 ADR *Vigentes*, se ejecutan tres auditorías…") y §8 (31 docs + 11 ADR en cola antes de código).
**Impacto:** alto. A ritmo realista (1 doc de calidad/día con Claude Code), son 6-8 semanas de escritura sin validar nada contra la realidad. Las decisiones más riesgosas (RLS en Supabase, pasarela, WABA multi-tenant) solo se validan con código y con los terceros, no con prosa. Además, documentar 31 docs sobre ADRs aún "Propuestos" (ver C2) multiplica el retrabajo si un ADR cambia.
**Corrección:** definir una **Documentación Mínima Viable (DMV)** que desbloquea el código del núcleo — `01-04` glosario, `03-02` tenancy, `03-03` modelo de datos (núcleo), `06-01` (sección de pruebas de aislamiento) — y pasar el resto a **just-in-time por hito** (mapa doc→fase en el plan de acción). Las 3 auditorías finales se reemplazan por mini-auditorías por lote al cierre de cada fase + una auditoría final ligera. Parche PA-6 y PA-7.

### C2 — Los ADR que sostienen todo el edificio están en "Propuesto", y hay estados incoherentes
**Evidencia:**
- ADR-002 (multi-tenant RLS) = "Propuesto", pero el índice v2 entero asume que está decidido (es *el* cambio v1→v2).
- ADR-011 = "Propuesto" en §4.4, pero 01-01 §14 dice "(Validado por el owner)" y D-2 en §7 dice "Aprobado". Tres estados distintos para la misma decisión.
- ADR-001 = "Aceptado — en revisión": estado inválido según la propia convención (§3.3: los ADR aceptados son inmutables, se *supersede*, no se revisan).
- D-6 figura abierta ("mesas/comandas o para-llevar, a definir") pero 01-01 §6.2 la da por confirmada con el owner (para-llevar/domicilio; dine-in diferido).
**Impacto:** alto y barato de arreglar. Si ADR-002 cambia, cascadea a ~20 documentos. Un doc "Vigente" (01-01) no debería depender de decisiones no aceptadas según tus propias reglas.
**Corrección:** una sesión de decisiones de 1-2 horas (tarea T0.1 del plan): aceptar formalmente ADR-002, 003, 008, 011 (y 004, 005, 006, 007 ya están Aceptados); ADR-001 queda "Aceptado" con nota "candidato a supersede vía D-3, disparador: >N tenants/mes en onboarding"; D-6 se marca resuelta en la parte de flujo. Parches PA-1, PA-2, PA-3.

### C3 — Falta el documento operativo del agente (CLAUDE.md)
**Evidencia:** el propósito declarado del repo es "que cualquier desarrollador **o modelo de IA** pueda continuar el proyecto", pero el catálogo no contiene el documento que gobierna *cómo* trabaja Claude Code en este repo: guardrails (dev→main con aprobación, plan-antes-de-ejecutar), reglas de sesión (una sesión por área para evitar el conflicto conocido de `.git/index.lock`), reglas de seguridad no negociables (`service_role` jamás en cliente; toda tabla nueva nace con RLS + test de aislamiento), comandos, definición de hecho.
**Impacto:** alto. En un proyecto donde el "equipo" es una persona + Claude Code, este es el documento más consultado de todos — y no existe ni está planificado. 08-01 cubre convenciones de código, no el flujo del agente.
**Corrección:** añadir al catálogo (dominio 08 o raíz del repo de código) y crearlo en Fase 0. **Entregado como borrador listo junto a esta auditoría (`CLAUDE.md`).** Parche PA-4.

### C4 — Dependencias externas con lead time reconocidas pero sin disparador
**Evidencia:** 01-01 §12 identifica correctamente que la aprobación de Nequi Negocios y la verificación de WhatsApp Business por Meta "no dependen del proyecto y deben incorporarse como pasos tempranos" — pero ningún documento ni fase dispara esas solicitudes. En el orden actual (44 docs → código → onboarding), los relojes externos arrancarían en el peor momento posible.
**Impacto:** alto en cronograma. Estos trámites pueden tardar semanas y son el verdadero riesgo de calendario del piloto, no el desarrollo.
**Corrección:** tarea humana T0.5 en la semana 1 del plan: solicitar acceso sandbox/producción de la pasarela elegida (ver C6), crear la WABA de pruebas de la plataforma e iniciar verificación del negocio en Meta. El código las alcanza; lo inverso no.

### C5 — RLS tratado como decisión, no como implementación con bordes filosos
**Evidencia:** ADR-002 y 03-02/04-01 (en cola) hablan de RLS como mecanismo, pero ningún propósito de documento lista los puntos donde RLS falla en la práctica con Supabase.
**Impacto:** crítico si se descubre en producción (es tu amenaza #1). Los bordes concretos que 03-02/04-01/06-01 **deben** cubrir como requisito de contenido:
- La `service_role` key **ignora RLS por completo**: toda Edge Function que la use es un bypass del aislamiento y debe filtrar por `tenant_id` explícitamente. Regla: `service_role` solo server-side, y solo donde sea imposible operar con el JWT del usuario.
- **Storage y Realtime tienen sus propias políticas**: el aislamiento no termina en las tablas. Buckets con policies por tenant; canales Realtime autorizados por RLS.
- **Rendimiento de policies**: `tenant_id` debe liderar los índices compuestos; las policies deben usar funciones estables/`(select auth.uid())` para evitar reevaluación por fila.
- **Deny-by-default**: RLS habilitado en el 100 % de las tablas desde la migración que las crea; prohibido `using (true)` salvo tablas de referencia públicas justificadas.
- **Restauración por tenant en base compartida** (hueco real para 05-05): PITR restaura *toda* la base; restaurar UN tenant sin tocar a los demás exige exports lógicos por tenant o aceptar explícitamente un RTO/RPO distinto para ese escenario. Hoy el propósito de 05-05 no lo menciona.
**Corrección:** parche PA-12 (requisitos de contenido) + el walking skeleton del plan valida estos puntos con tests en CI desde la semana 2, no en la auditoría final.

### C6 — La primera pasarela merece una decisión abierta propia (D-7), no un supuesto
**Evidencia:** 01-01 §7.2 asume Nequi como primera implementación ("hoy implementa Nequi"). No hay análisis del trade-off frente a la alternativa obvia.
**Impacto:** medio-alto. Trade-off honesto:
- **Nequi API directa**: sin intermediario ni comisión de pasarela adicional; pero el acceso/aprobación a Nequi Conecta para terceros ha sido históricamente lento y con fricción para desarrolladores pequeños, y cada tenant necesita su propio trámite — multiplica tu cuello de botella de onboarding (mismo patrón que la WABA).
- **Wompi (u otra pasarela) con Nequi como método de pago**: API y sandbox accesibles, cada tenant abre su cuenta Wompi (sigue cumpliendo el no-agregador: fondos directos al tenant, credenciales por tenant), Nequi disponible como método para el cliente final; a cambio, comisión por transacción y un tercero más en la cadena.
- La abstracción multi-pasarela (ADR-003) hace la elección **reversible**: es puerta de dos vías. Precisamente por eso se decide rápido con un spike, no con semanas de análisis.
**Corrección:** añadir **D-7** a decisiones abiertas con spike de validación en semana 1 (¿en cuántos días consigo credenciales sandbox y un pago de prueba con cada opción?). El que responda primero con sandbox funcional gana v1. Verificar condiciones vigentes (comisiones, tiempos de dispersión) antes de fijarlo en el ADR — cambian. Parche PA-5.

### C7 — Ambigüedad del doble aislamiento (RLS + dedicado)
**Evidencia:** ADR-002 y D-4: "shared-schema + RLS por defecto; esquema/DB dedicado para tiers enterprise".
**Impacto:** medio. Si se interpreta como "construir ambos caminos", viola tu propio principio #3 (simplicidad) y duplica migraciones, provisioning y pruebas. El costo del aislamiento dedicado no se paga "por si acaso".
**Corrección:** redacción explícita en ADR-002/03-02: **v1 implementa únicamente shared-schema + RLS**; el aislamiento dedicado es una *costura* (no acoplar nada que lo impida: no IDs globales cruzados entre tenants, resolución de tenant centralizada) pero **cero código** hasta que un cliente enterprise lo pague. Parche PA-2 (nota en el ADR).

### C8 — No hay decisión de estructura de repositorio
**Evidencia:** ADR-007 decide el stack del panel; nada decide monorepo vs. multi-repo, ni dónde viven docs, migraciones, Edge Functions y panel.
**Impacto:** medio, pero **bloquea el primer commit**. 05-03 habla de "repos, ramas" sin que exista la decisión.
**Corrección:** **D-8 + ADR-012**. Recomendación (a validar en T0.1): **monorepo pnpm** — `apps/panel`, `packages/core` (tipos compartidos, SDK de módulos), `supabase/` (migrations, functions, tests), `docs/` (este repo documental absorbido). Racional: una persona, PRs atómicos doc+código (tu propia regla del índice §2 lo exige), un solo CI. Contra: el repo crece y CI corre todo; irrelevante a esta escala. Parche PA-5.

---

## 4. Hallazgos menores (vigilar / deuda tolerable)

| # | Hallazgo | Corrección |
|---|---|---|
| m1 | Las métricas de §8 no cuadran con el catálogo (33 docs, 1 vigente ⇒ 32 en cola, no 31; el índice se cuenta como "Vigente" pero no está en el denominador de 33). | Definir el denominador: el catálogo es la fuente; las métricas se derivan de contar filas por estado. PA-8. |
| m2 | §3.2 "Ningún documento *Vigente* contiene **ejemplos**, 'TBD'…" — 01-01 (Vigente) contiene un diagrama de ejemplo; la palabra genera falsos positivos en auditorías futuras. | Reescribir: "contenido de relleno, placeholders, 'TBD' ni 'por completar'". PA-9. |
| m3 | Dependencia invertida: 01-05 (producto) "Depende de" 03-04 (arquitectura), contra la cadena de trazabilidad de §5 (necesidad → diseño). | 01-05 define la matriz (qué); 03-04 el mecanismo (cómo). Cambiar a dependencia mutua declarada o 03-04 ← 01-05. PA-8. |
| m4 | 01-01 §7.2 "hoy **implementa** Nequi" — tiempo verbal que implica código existente; no hay código. | "v1 implementa únicamente la pasarela definida en D-7". PA-10. |
| m5 | Nombre de carpeta `mysaastech-docs/` vs. nombre del paquete (`Business_OS.zip`) vs. D-1 abierta. | Cerrar D-1 en T0.1; renombrar una sola vez al crear el monorepo. |
| m6 | Propósito de 03-06 no menciona los límites de tiempo de Edge Functions. | Requisito de contenido: patrón webhook-rápido (validar firma + persistir + 200) con procesamiento asíncrono vía cola en Postgres. PA-12. |
| m7 | 01-03 (pricing) deberá modelar el costo de WhatsApp por tenant con el **esquema de precios vigente de Meta** (cambió de por-conversación a por-mensaje de plantilla); no asumir cifras de memoria. | Requisito de contenido + tarea de verificación en la fase de pagos/WhatsApp. PA-12. |

---

## 5. Parches aplicables (para Claude Code — tarea T0.2 del plan)

Aplicar sobre `00-INDEX.md` → **v2.1.0** y `01-01` → **v1.0.1**. Cada parche es una edición quirúrgica; el changelog del índice registra "v2.0.0 → v2.1.0: correcciones de auditoría 2026-07-02".

- **PA-1** · §4.4: ADR-001 estado → `Aceptado` + nota: "Candidato a supersede vía D-3. Disparador: el onboarding manual de WABA supere N tenants/mes o M horas/tenant."
- **PA-2** · §4.4: tras la sesión de decisiones T0.1, ADR-002, 003, 008, 011 → `Aceptado` (y 009, 010 → `Aceptado` como *costuras*, con alcance v1 = solo la costura). En ADR-002 añadir: "v1 implementa exclusivamente shared-schema + RLS; el aislamiento dedicado es una costura sin código hasta demanda enterprise real."
- **PA-3** · §7 D-2: cerrar (aprobada, coherente con ADR-011 Aceptado). D-6: marcar resuelta la parte de flujo (para-llevar/domicilio; dine-in diferido — ref. 01-01 §6.2); dejar abierta solo la lista definitiva de módulos v1.
- **PA-4** · §4.9: añadir fila `08-03 | Flujo de trabajo con Claude Code (CLAUDE.md) | Guardrails del agente: plan-antes-de-ejecutar, dev→main con aprobación, reglas RLS/service_role, sesiones, DoD | CTO | 08-01 | En redacción`. El archivo vive en la raíz del repo de código; 08-03 lo referencia.
- **PA-5** · §7: añadir `D-7 | Primera pasarela de v1: Nequi API directa vs. pasarela con Nequi como método | ADR-003 / 03-07 | Spike de sandbox en semana 1; gana la que dé sandbox funcional primero` y `D-8 | Estructura de repositorios | ADR-012 (nuevo) / 05-03 | Monorepo pnpm (apps/panel, packages/core, supabase/, docs/)`. §4.4: añadir fila ADR-012.
- **PA-6** · §6: reemplazar el protocolo de auditoría única final por: "**Mini-auditoría por lote**: al cierre de cada fase del plan de entrega se auditan consistencia, glosario, dependencias y trazabilidad de los documentos tocados en la fase. **Auditoría final ligera** (arquitectura/documentación/producto) antes de declarar el paquete terminado."
- **PA-7** · Nueva subsección en §1 o §2: "**Documentación mínima viable (DMV)** para iniciar código: 01-04, 03-02, 03-03 (núcleo), 06-01 (aislamiento) + ADR aceptados. El resto se redacta just-in-time según el mapa doc→fase del plan de entrega (`07-01`)."
- **PA-8** · §8: recalcular métricas con denominador explícito. §4.1: resolver dependencia 01-05 ↔ 03-04 (m3).
- **PA-9** · §3.2: redacción de m2.
- **PA-10** · 01-01 §7.2: redacción de m4 (v1.0.1).
- **PA-11** · 01-01 §14: alinear "(Validado por el owner)" con el estado real del ADR-011 tras T0.1.
- **PA-12** · Añadir a los propósitos del catálogo los **requisitos de contenido** de C5 (03-02, 04-01, 05-05, 06-01), m6 (03-06) y m7 (01-03), para que quien redacte esos docs no los omita.

---

## 6. Validación del pivote v1→v2 (instancia aislada → multi-tenant RLS)

Lo pediste implícitamente al declarar el pivote como el cambio central. Evaluación honesta:

**Correcto para tus restricciones.** Con carga operativa como restricción dominante (una persona), N proyectos Supabase = N × (migraciones, backups, monitoreo, secretos, upgrades) — insostenible más allá de ~5 clientes, y los unit economics no cierran (costo fijo por proyecto vs. suscripción PYME). Multi-tenant compartido invierte la ecuación: costo marginal por tenant cercano a cero, una sola superficie de operación.

**Lo que sacrificas y debes gestionar (no es gratis):**
1. **Blast radius**: una migración mala afecta a todos los tenants a la vez. Mitigación: migraciones probadas contra `db reset` + staging antes de main (05-03), y backups con PITR.
2. **El aislamiento pasa de físico a lógico**: la RLS es ahora código crítico de seguridad. Ya lo tratas como amenaza #1 — la auditoría exige que además sea **fitness function en CI desde el primer commit** (plan, Fase 2), no una categoría de pruebas futura.
3. **Restauración por tenant** deja de ser trivial (C5). Decisión consciente pendiente para 05-05.
4. **Vecino ruidoso**: un tenant con volumen anómalo degrada a los demás. Tolerable en v1 (3-5 restaurantes); vigilar con métricas por tenant (05-04).

Veredicto: pivote aprobado; los cuatro costos quedan asignados a documentos/fases concretas.

---

## 7. Resumen ejecutivo de la auditoría

| Prioridad | Hallazgo | Acción | Dónde |
|---|---|---|---|
| 🔴 Ya | C1 Waterfall documental | DMV + just-in-time | PA-6, PA-7, plan Fase 1 |
| 🔴 Ya | C2 ADRs incoherentes | Sesión de decisiones | T0.1 + PA-1..3 |
| 🔴 Ya | C3 Falta CLAUDE.md | Archivo entregado | PA-4 + `CLAUDE.md` |
| 🔴 Ya | C4 Relojes externos parados | Solicitudes semana 1 | T0.5 |
| 🔴 Ya | C5 Bordes de RLS | Requisitos de contenido + skeleton con tests | PA-12, plan Fase 2 |
| 🟡 Semana 1 | C6 Pasarela primera | D-7 + spike sandbox | PA-5, T0.1/T0.5 |
| 🟡 Semana 1 | C7 Doble aislamiento | Nota "solo costura" en ADR-002 | PA-2 |
| 🟡 Semana 1 | C8 Estructura de repos | D-8 + ADR-012 | PA-5, T0.3 |
| ⚪ Tolerable | m1–m7 | Parches de redacción | PA-8..PA-12 |

*Fin de la auditoría. Siguiente artefacto: `PLAN-DE-ACCION-claude-code.md`.*
