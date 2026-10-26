import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, mensagemErro } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { pegarLocalizacao, distanciaMetros, formatarDistancia, type Posicao } from "@/lib/geo";
import { comprimirFoto } from "@/lib/imagem";
import { fmtDataHora } from "@/lib/formato";
import type { Loja, Pergunta, Visita } from "@/lib/tipos";
import { AreaTexto, Aviso, Botao, Cartao, Entrada, Girando, Selecao, Selo, TelaCarregando, Vazio, cx } from "@/components/ui";

const MAX_FOTOS = 6;

interface Foto { id: string; blob: Blob; previa: string }

export default function NovaVisita() {
  const { perfil, empresa } = useAuth();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [pos, setPos] = useState<Posicao | null>(null);
  const [buscandoPos, setBuscandoPos] = useState(false);
  const [erroPos, setErroPos] = useState("");

  const [lojaId, setLojaId] = useState("");
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [processandoFoto, setProcessandoFoto] = useState(false);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [observacao, setObservacao] = useState("");

  const [enviando, setEnviando] = useState("");
  const [erro, setErro] = useState("");
  const [concluida, setConcluida] = useState<Visita | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const [l, p] = await Promise.all([
        supabase.from("lojas").select("*").eq("ativa", true).order("nome"),
        supabase.from("perguntas").select("*").eq("ativa", true).order("ordem").order("criado_em"),
      ]);
      setLojas((l.data as Loja[]) ?? []);
      setPerguntas((p.data as Pergunta[]) ?? []);
      setCarregando(false);
    })();
    atualizarLocalizacao();
  }, []);

  async function atualizarLocalizacao(): Promise<Posicao | null> {
    setBuscandoPos(true);
    setErroPos("");
    try {
      const p = await pegarLocalizacao();
      setPos(p);
      return p;
    } catch (e) {
      setErroPos(mensagemErro(e));
      return null;
    } finally {
      setBuscandoPos(false);
    }
  }

  // lojas ordenadas pela distância do promotor
  const lojasComDistancia = useMemo(() => {
    const lista = lojas.map((l) => ({ ...l, dist: pos ? distanciaMetros(pos.latitude, pos.longitude, l.latitude, l.longitude) : null }));
    return pos ? lista.sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0)) : lista;
  }, [lojas, pos]);

  // pré-seleciona a loja mais próxima se ele estiver dentro do raio
  useEffect(() => {
    if (lojaId || !lojasComDistancia.length) return;
    const perto = lojasComDistancia[0];
    if (perto.dist !== null && perto.dist <= perto.raio_m) setLojaId(perto.id);
  }, [lojasComDistancia, lojaId]);

  const lojaSel = lojasComDistancia.find((l) => l.id === lojaId);
  const naLoja = lojaSel && lojaSel.dist !== null ? lojaSel.dist <= lojaSel.raio_m : null;

  async function adicionarFotos(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setProcessandoFoto(true);
    setErro("");
    try {
      const novas: Foto[] = [];
      for (const arq of Array.from(arquivos).slice(0, MAX_FOTOS - fotos.length)) {
        const blob = await comprimirFoto(arq);
        novas.push({ id: crypto.randomUUID(), blob, previa: URL.createObjectURL(blob) });
      }
      setFotos((f) => [...f, ...novas]);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setProcessandoFoto(false);
      if (inputFoto.current) inputFoto.current.value = "";
    }
  }

  function removerFoto(id: string) {
    setFotos((f) => {
      const alvo = f.find((x) => x.id === id);
      if (alvo) URL.revokeObjectURL(alvo.previa);
      return f.filter((x) => x.id !== id);
    });
  }

  const faltando = useMemo(() => {
    const itens: string[] = [];
    if (!lojaId) itens.push("escolher a loja");
    if (!fotos.length) itens.push("tirar pelo menos 1 foto");
    const semResposta = perguntas.filter((p) => p.obrigatoria && !respostas[p.id]?.trim()).length;
    if (semResposta) itens.push(`responder ${semResposta} pergunta${semResposta > 1 ? "s" : ""}`);
    return itens;
  }, [lojaId, fotos, perguntas, respostas]);

  async function enviar() {
    if (faltando.length || !perfil || !empresa) return;
    setErro("");
    try {
      setEnviando("Confirmando sua localização…");
      const posAgora = (await atualizarLocalizacao()) ?? pos;
      if (!posAgora) throw new Error("Sem localização não dá para enviar. Ligue o GPS e tente de novo.");

      const visitaId = crypto.randomUUID();
      const caminhos: string[] = [];
      for (let i = 0; i < fotos.length; i++) {
        setEnviando(`Enviando foto ${i + 1} de ${fotos.length}…`);
        const caminho = `${empresa.id}/${perfil.id}/${visitaId}/${i + 1}.jpg`;
        const { error } = await supabase.storage.from("fotos").upload(caminho, fotos[i].blob, { contentType: "image/jpeg" });
        if (error) throw error;
        caminhos.push(caminho);
      }

      setEnviando("Registrando a visita…");
      const { data, error } = await supabase.rpc("registrar_visita", {
        p_visita_id: visitaId,
        p_loja_id: lojaId,
        p_latitude: posAgora.latitude,
        p_longitude: posAgora.longitude,
        p_precisao_m: posAgora.precisao,
        p_observacao: observacao,
        p_fotos: caminhos,
        p_respostas: perguntas.map((p) => ({ pergunta_id: p.id, resposta: respostas[p.id] ?? "" })),
      });
      if (error) throw error;

      fotos.forEach((f) => URL.revokeObjectURL(f.previa));
      setConcluida(data as Visita);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setEnviando("");
    }
  }

  function novaVisita() {
    setConcluida(null);
    setLojaId("");
    setFotos([]);
    setRespostas({});
    setObservacao("");
    atualizarLocalizacao();
    window.scrollTo({ top: 0 });
  }

  if (carregando) return <TelaCarregando />;

  if (concluida) {
    const loja = lojas.find((l) => l.id === concluida.loja_id);
    return (
      <div className="mx-auto max-w-md pt-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-marca-100 text-marca-700">
          <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h1 className="mt-5 text-2xl font-bold text-stone-900">Visita enviada!</h1>
        <p className="mt-1 text-stone-600">{loja?.nome} · {fmtDataHora(concluida.criado_em)}</p>
        <div className="mt-4">
          {concluida.na_loja
            ? <Selo cor="verde">Na loja · {formatarDistancia(concluida.distancia_m)}</Selo>
            : <Selo cor="vermelho">Fora da loja · {formatarDistancia(concluida.distancia_m)}</Selo>}
        </div>
        <div className="mt-8 grid gap-3">
          <Botao onClick={novaVisita} className="py-3">Registrar outra visita</Botao>
          <Link to="/historico" className="text-sm font-semibold text-marca-700">Ver meu histórico</Link>
        </div>
      </div>
    );
  }

  if (!lojas.length) {
    return <Vazio titulo="Nenhuma loja cadastrada ainda" texto="Peça ao seu gestor para cadastrar as lojas que você atende." />;
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Nova visita</h1>
        <p className="text-sm text-stone-500">Olá, {perfil?.nome.split(" ")[0]}. Preencha e envie ao terminar o trabalho na loja.</p>
      </div>

      {/* 1. LOCALIZAÇÃO E LOJA */}
      <Cartao className="p-4">
        <Passo n={1} titulo="Loja" />
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2.5 text-sm">
          <div className="flex items-center gap-2 text-stone-700">
            {buscandoPos ? <Girando className="h-4 w-4 text-marca-600" /> : <span className={cx("h-2.5 w-2.5 rounded-full", pos ? "bg-marca-500" : "bg-red-500")} />}
            {buscandoPos ? "Buscando GPS…" : pos ? `GPS ativo · precisão ±${pos.precisao} m` : "Sem localização"}
          </div>
          <button onClick={atualizarLocalizacao} disabled={buscandoPos} className="font-semibold text-marca-700 disabled:opacity-50">Atualizar</button>
        </div>
        {erroPos && <div className="mt-3"><Aviso>{erroPos}</Aviso></div>}

        <div className="mt-3">
          <Selecao value={lojaId} onChange={(e) => setLojaId(e.target.value)} aria-label="Loja">
            <option value="">Selecione a loja…</option>
            {lojasComDistancia.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}{l.dist !== null ? ` — ${formatarDistancia(l.dist)}` : ""}
              </option>
            ))}
          </Selecao>
        </div>
        {lojaSel && naLoja !== null && (
          <div className="mt-3">
            {naLoja
              ? <Selo cor="verde">✓ Você está na loja</Selo>
              : <Selo cor="amarelo">Você está a {formatarDistancia(lojaSel.dist!)} da loja — a visita será registrada como fora da loja</Selo>}
          </div>
        )}
      </Cartao>

      {/* 2. FOTOS */}
      <Cartao className="p-4">
        <Passo n={2} titulo="Fotos" detalhe={`${fotos.length}/${MAX_FOTOS} · obrigatória`} />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {fotos.map((f) => (
            <div key={f.id} className="relative aspect-square overflow-hidden rounded-xl bg-stone-100">
              <img src={f.previa} alt="Foto da visita" className="h-full w-full object-cover" />
              <button
                onClick={() => removerFoto(f.id)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                aria-label="Remover foto"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /></svg>
              </button>
            </div>
          ))}
          {fotos.length < MAX_FOTOS && (
            <button
              onClick={() => inputFoto.current?.click()}
              disabled={processandoFoto}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-marca-200 bg-marca-50 text-marca-700 transition hover:bg-marca-100"
            >
              {processandoFoto ? <Girando /> : (
                <>
                  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" /><circle cx="12" cy="13" r="3.5" /></svg>
                  <span className="text-xs font-semibold">Tirar foto</span>
                </>
              )}
            </button>
          )}
        </div>
        <input
          ref={inputFoto} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => adicionarFotos(e.target.files)}
        />
      </Cartao>

      {/* 3. PERGUNTAS */}
      {perguntas.length > 0 && (
        <Cartao className="p-4">
          <Passo n={3} titulo="Checklist" />
          <div className="mt-3 divide-y divide-stone-100">
            {perguntas.map((p) => (
              <div key={p.id} className="py-3 first:pt-0 last:pb-0">
                <p className="mb-2 text-sm font-medium text-stone-800">
                  {p.texto} {p.obrigatoria && <span className="text-red-600">*</span>}
                </p>
                {p.tipo === "sim_nao" && (
                  <div className="grid grid-cols-2 gap-2">
                    {["Sim", "Não"].map((op) => (
                      <button
                        key={op}
                        onClick={() => setRespostas((r) => ({ ...r, [p.id]: op }))}
                        className={cx(
                          "rounded-xl border py-2.5 text-sm font-semibold transition",
                          respostas[p.id] === op
                            ? op === "Sim" ? "border-marca-600 bg-marca-600 text-white" : "border-red-600 bg-red-600 text-white"
                            : "border-stone-300 bg-white text-stone-700",
                        )}
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                )}
                {p.tipo === "texto" && (
                  <AreaTexto value={respostas[p.id] ?? ""} onChange={(e) => setRespostas((r) => ({ ...r, [p.id]: e.target.value }))} />
                )}
                {p.tipo === "numero" && (
                  <Entrada type="number" inputMode="decimal" value={respostas[p.id] ?? ""}
                           onChange={(e) => setRespostas((r) => ({ ...r, [p.id]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
        </Cartao>
      )}

      {/* 4. OBSERVAÇÃO */}
      <Cartao className="p-4">
        <Passo n={perguntas.length ? 4 : 3} titulo="Observação" detalhe="opcional" />
        <AreaTexto className="mt-3" placeholder="Algo que o gestor precisa saber?" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
      </Cartao>

      {erro && <Aviso>{erro}</Aviso>}

      <div className="sticky bottom-20 z-20 sm:bottom-4">
        <Botao onClick={enviar} disabled={faltando.length > 0} carregando={!!enviando} className="w-full py-4 text-base shadow-lg">
          {enviando || "Enviar visita"}
        </Botao>
        {faltando.length > 0 && (
          <p className="mt-2 rounded-lg bg-white/90 py-1 text-center text-xs text-stone-500">Falta: {faltando.join(", ")}</p>
        )}
      </div>
    </div>
  );
}

function Passo({ n, titulo, detalhe }: { n: number; titulo: string; detalhe?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-marca-600 text-xs font-bold text-white">{n}</span>
        <h2 className="font-semibold text-stone-900">{titulo}</h2>
      </div>
      {detalhe && <span className="text-xs text-stone-500">{detalhe}</span>}
    </div>
  );
}
