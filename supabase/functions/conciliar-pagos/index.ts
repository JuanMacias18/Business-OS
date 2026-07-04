// Edge Function conciliar-pagos (T5.1 §6). Sin disparador automatico
// todavia (mismo criterio que expirar_reservas_vencidas, 03-05 §5) --
// se invoca manualmente o por un scheduler externo cuando haga falta.
import { createClient } from "npm:@supabase/supabase-js@2";
import { conciliarPagosPendientes } from "../_shared/conciliar-pagos-handler.ts";

Deno.serve(async (req) => {
  const { umbral_minutos } = await req.json().catch(() => ({ umbral_minutos: 10 }));

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const resultado = await conciliarPagosPendientes(supabase, umbral_minutos ?? 10);

  return new Response(JSON.stringify(resultado), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
