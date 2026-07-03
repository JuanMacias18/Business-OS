import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { CatalogManager } from "./CatalogManager";

interface Tenant {
  id: string;
  nombre: string;
}

export function TenantDashboard() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // La resolucion de tenant nunca lee ningun parametro de la URL ni
      // del cliente: sale exclusivamente del claim tenant_id del JWT
      // (03-02 §3), via RLS. No hay forma de manipular esta consulta
      // para ver el tenant de otro.
      const [{ data: tenants }, { data: memberships }] = await Promise.all([
        supabase.from("tenants").select("id, nombre"),
        supabase.from("memberships").select("role"),
      ]);
      setTenant((tenants?.[0] as Tenant) ?? null);
      setIsAdmin(memberships?.[0]?.role === "admin");
      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return <p data-testid="tenant-loading">Cargando...</p>;
  }

  return (
    <div data-testid="tenant-dashboard" className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-3">
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
      {tenant && <CatalogManager tenantId={tenant.id} isAdmin={isAdmin} />}
    </div>
  );
}
