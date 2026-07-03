import { useEffect, useState } from "react";
import type { Session } from "@business-os/core";
import { supabase } from "./lib/supabaseClient";
import { LoginForm } from "./components/LoginForm";
import { TenantDashboard } from "./components/TenantDashboard";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      {loading ? <p>Cargando...</p> : session ? <TenantDashboard /> : <LoginForm />}
    </main>
  );
}
