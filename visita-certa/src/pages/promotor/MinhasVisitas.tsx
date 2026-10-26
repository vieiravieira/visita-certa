import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { fmtData, fmtHora } from "@/lib/formato";
import type { VisitaCompleta } from "@/lib/tipos";
import { Cartao, Modal, TelaCarregando, TituloPagina, Vazio } from "@/components/ui";
import { DetalheVisita, SELECT_VISITA, SeloLocal } from "@/components/DetalheVisita";

export default function MinhasVisitas() {
  const { perfil } = useAuth();
  const [visitas, setVisitas] = useState<VisitaCompleta[] | null>(null);
  const [aberta, setAberta] = useState<VisitaCompleta | null>(null);

  useEffect(() => {
    if (!perfil) return;
    supabase
      .from("visitas")
      .select(SELECT_VISITA)
      .eq("promotor_id", perfil.id)
      .order("criado_em", { ascending: false })
      .limit(100)
      .then(({ data }) => setVisitas((data as unknown as VisitaCompleta[]) ?? []));
  }, [perfil]);

  if (!visitas) return <TelaCarregando />;

  // agrupa por dia
  const porDia = visitas.reduce<Record<string, VisitaCompleta[]>>((acc, v) => {
    (acc[fmtData(v.criado_em)] ??= []).push(v);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-xl">
      <TituloPagina titulo="Meu histórico" sub="Suas últimas 100 visitas" />
      {!visitas.length && <Vazio titulo="Nenhuma visita ainda" texto="As visitas que você enviar aparecem aqui." />}
      <div className="space-y-6">
        {Object.entries(porDia).map(([dia, lista]) => (
          <section key={dia}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{dia} · {lista.length} visita{lista.length > 1 ? "s" : ""}</h2>
            <Cartao className="divide-y divide-stone-100">
              {lista.map((v) => (
                <button key={v.id} onClick={() => setAberta(v)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-50">
                  <div>
                    <p className="font-semibold text-stone-900">{v.loja?.nome}</p>
                    <p className="text-sm text-stone-500">{fmtHora(v.criado_em)} · {v.visita_fotos.length} foto{v.visita_fotos.length > 1 ? "s" : ""}</p>
                  </div>
                  <SeloLocal v={v} />
                </button>
              ))}
            </Cartao>
          </section>
        ))}
      </div>
      <Modal aberto={!!aberta} aoFechar={() => setAberta(null)} titulo="Detalhe da visita">
        {aberta && <DetalheVisita visita={aberta} />}
      </Modal>
    </div>
  );
}
