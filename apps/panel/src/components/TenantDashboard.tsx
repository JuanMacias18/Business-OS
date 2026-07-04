import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { CatalogManager } from "./CatalogManager";
import { OrdersManager } from "./OrdersManager";

interface Tenant {
  id: string;
  nombre: string;
}

export function TenantDashboard() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"catalogo" | "pedidos">("pedidos");

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

      {tenant && (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="tab-pedidos"
              onClick={() => setTab("pedidos")}
              className={`rounded px-3 py-1 text-sm ${tab === "pedidos" ? "bg-slate-100 text-slate-950" : "border border-slate-700"}`}
            >
              Pedidos
            </button>
            <button
              type="button"
              data-testid="tab-catalogo"
              onClick={() => setTab("catalogo")}
              className={`rounded px-3 py-1 text-sm ${tab === "catalogo" ? "bg-slate-100 text-slate-950" : "border border-slate-700"}`}
            >
              Catálogo
            </button>
          </div>
          {tab === "pedidos" ? (
            <OrdersManager tenantId={tenant.id} />
          ) : (
            <CatalogManager tenantId={tenant.id} isAdmin={isAdmin} />
          )}
        </>
      )}
    </div>
  );
}
