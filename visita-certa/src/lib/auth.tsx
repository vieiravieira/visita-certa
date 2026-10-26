import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Empresa, Perfil } from "./tipos";

interface AuthCtx {
  carregando: boolean;
  sessao: Session | null;
  perfil: Perfil | null;
  empresa: Empresa | null;
  recarregar: () => Promise<void>;
  sair: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [sessao, setSessao] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);

  const carregarPerfil = useCallback(async (s: Session | null) => {
    if (!s) {
      setPerfil(null);
      setEmpresa(null);
      return;
    }
    const { data: p } = await supabase.from("perfis").select("*").eq("id", s.user.id).maybeSingle();
    setPerfil((p as Perfil) ?? null);
    if (p?.empresa_id) {
      const { data: e } = await supabase.from("empresas").select("*").eq("id", p.empresa_id).maybeSingle();
      setEmpresa((e as Empresa) ?? null);
    } else {
      setEmpresa(null);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!ativo) return;
      setSessao(data.session);
      await carregarPerfil(data.session);
      if (ativo) setCarregando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === "TOKEN_REFRESHED") return;
      setSessao(s);
      // fora do callback para não travar o cliente do Supabase
      setTimeout(() => carregarPerfil(s), 0);
    });
    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, [carregarPerfil]);

  const valor: AuthCtx = {
    carregando,
    sessao,
    perfil,
    empresa,
    recarregar: () => carregarPerfil(sessao),
    sair: async () => {
      await supabase.auth.signOut();
      setPerfil(null);
      setEmpresa(null);
    },
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth fora do AuthProvider");
  return c;
}
