import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface Tenant {
  id: string;
  nombre: string;
}

export function TenantDashboard() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // La resolucion de tenant nunca lee ningun parametro de la URL ni
    // del cliente: sale exclusivamente del claim tenant_id del JWT
    // (03-02 §3), via RLS. No hay forma de manipular esta consulta
    // para ver el tenant de otro.
    supabase
      .from("tenants")
      .select("id, nombre")
      .then(({ data }) => {
        setTenant((data?.[0] as Tenant) ?? null);
        setLoading(false);
      });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return <p data-testid="tenant-loading">Cargando...</p>;
  }

  return (
    <div data-testid="tenant-dashboard" className="flex flex-col items-center gap-3">
      <p data-testid="tenant-name" className="text-xl font-medium">
        {tenant ? tenant.nombre : "Sin tenant asignado"}
      </p>
      <button
        type="button"
        onClick={handleLogout}
        data-testid="logout-button"
        className="rounded border border-slate-700 px-3 py-1 text-sm"
      >
        Salir
      </button>
    </div>
  );
}
