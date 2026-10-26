import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtDataHora } from "@/lib/formato";
import { formatarDistancia, linkMapa } from "@/lib/geo";
import type { VisitaCompleta } from "@/lib/tipos";
import { Girando, Selo } from "./ui";

export const SELECT_VISITA =
  "*, loja:lojas(nome, endereco, latitude, longitude, raio_m), promotor:perfis(nome, email), " +
  "visita_fotos(id, caminho), visita_respostas(id, pergunta_texto, resposta)";

/** Gera links temporários (1 h) para as fotos privadas. */
export function useFotosAssinadas(caminhos: string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const chave = caminhos.join("|");
  useEffect(() => {
    if (!caminhos.length) return;
    let ativo = true;
    supabase.storage.from("fotos").createSignedUrls(caminhos, 3600).then(({ data }) => {
      if (!ativo || !data) return;
      const m: Record<string, string> = {};
      data.forEach((d) => d.path && d.signedUrl && (m[d.path] = d.signedUrl));
      setUrls(m);
    });
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return urls;
}

export function SeloLocal({ v }: { v: Pick<VisitaCompleta, "na_loja" | "distancia_m"> }) {
  return v.na_loja
    ? <Selo cor="verde">Na loja · {formatarDistancia(v.distancia_m)}</Selo>
    : <Selo cor="vermelho">Fora · {formatarDistancia(v.distancia_m)}</Selo>;
}

export function DetalheVisita({ visita }: { visita: VisitaCompleta }) {
  const urls = useFotosAssinadas(visita.visita_fotos.map((f) => f.caminho));
  const [ampliada, setAmpliada] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Info rotulo="Promotor" valor={visita.promotor?.nome ?? "—"} />
        <Info rotulo="Data e hora" valor={fmtDataHora(visita.criado_em)} />
        <Info rotulo="Loja" valor={visita.loja?.nome ?? "—"} sub={visita.loja?.endereco ?? undefined} />
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Localização</p>
          <div className="mt-1"><SeloLocal v={visita} /></div>
          <p className="mt-1 text-xs text-stone-500">
            Raio da loja: {visita.loja?.raio_m} m{visita.precisao_m ? ` · precisão do GPS ±${Math.round(visita.precisao_m)} m` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a href={linkMapa(visita.latitude, visita.longitude)} target="_blank" rel="noreferrer"
           className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">
          📍 Onde o promotor estava
        </a>
        {visita.loja && (
          <a href={linkMapa(visita.loja.latitude, visita.loja.longitude)} target="_blank" rel="noreferrer"
             className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">
            🏪 Onde fica a loja
          </a>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">Fotos ({visita.visita_fotos.length})</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {visita.visita_fotos.map((f) => (
            <button key={f.id} onClick={() => urls[f.caminho] && setAmpliada(urls[f.caminho])}
                    className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-stone-100">
              {urls[f.caminho]
                ? <img src={urls[f.caminho]} alt="Foto da visita" className="h-full w-full object-cover" loading="lazy" />
                : <Girando className="h-5 w-5 text-stone-400" />}
            </button>
          ))}
        </div>
      </div>

      {visita.visita_respostas.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">Checklist</p>
          <dl className="divide-y divide-stone-100 rounded-xl border border-stone-200">
            {visita.visita_respostas.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-4 px-3 py-2.5 text-sm">
                <dt className="text-stone-600">{r.pergunta_texto}</dt>
                <dd className={
                  r.resposta === "Sim" ? "font-semibold text-marca-700"
                    : r.resposta === "Não" ? "font-semibold text-red-700"
                    : "text-right font-medium text-stone-900"}>
                  {r.resposta || "—"}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {visita.observacao && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-500">Observação</p>
          <p className="whitespace-pre-wrap rounded-xl bg-stone-50 p-3 text-sm text-stone-800">{visita.observacao}</p>
        </div>
      )}

      {ampliada && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-3" onClick={() => setAmpliada(null)}>
          <img src={ampliada} alt="Foto ampliada" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}

function Info({ rotulo, valor, sub }: { rotulo: string; valor: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{rotulo}</p>
      <p className="mt-0.5 font-semibold text-stone-900">{valor}</p>
      {sub && <p className="text-xs text-stone-500">{sub}</p>}
    </div>
  );
}
