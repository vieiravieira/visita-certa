import { useEffect, useState, type FormEvent } from "react";
import { supabase, mensagemErro } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { linkMapa, pegarLocalizacao } from "@/lib/geo";
import type { Loja } from "@/lib/tipos";
import { Aviso, Botao, Cartao, Entrada, Modal, Rotulo, Selo, TelaCarregando, TituloPagina, Vazio } from "@/components/ui";

interface Form { id?: string; nome: string; endereco: string; coords: string; raio_m: number; ativa: boolean }
const vazio: Form = { nome: "", endereco: "", coords: "", raio_m: 200, ativa: true };

/** Aceita "-22.9068, -43.1729" ou um link do Google Maps com @lat,lng ou q=lat,lng */
function lerCoordenadas(txt: string): { lat: number; lng: number } | null {
  const m = txt.replace(/\s/g, "").match(/(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export default function Lojas() {
  const { empresa } = useAuth();
  const [lojas, setLojas] = useState<Loja[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [pegandoGps, setPegandoGps] = useState(false);
  const [busca, setBusca] = useState("");

  const carregar = () =>
    supabase.from("lojas").select("*").order("nome").then(({ data }) => setLojas((data as Loja[]) ?? []));
  useEffect(() => { carregar(); }, []);

  async function usarMinhaLocalizacao() {
    if (!form) return;
    setPegandoGps(true);
    setErro("");
    try {
      const p = await pegarLocalizacao();
      setForm({ ...form, coords: `${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}` });
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setPegandoGps(false);
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form || !empresa) return;
    const c = lerCoordenadas(form.coords);
    if (!c) return setErro("Coordenadas inválidas. Use o formato -22.906800, -43.172900.");
    setSalvando(true);
    setErro("");
    const dados = {
      empresa_id: empresa.id, nome: form.nome.trim(), endereco: form.endereco.trim() || null,
      latitude: c.lat, longitude: c.lng, raio_m: form.raio_m, ativa: form.ativa,
    };
    const { error } = form.id
      ? await supabase.from("lojas").update(dados).eq("id", form.id)
      : await supabase.from("lojas").insert(dados);
    setSalvando(false);
    if (error) return setErro(mensagemErro(error));
    setForm(null);
    carregar();
  }

  if (!lojas) return <TelaCarregando />;
  const filtradas = lojas.filter((l) => (l.nome + " " + (l.endereco ?? "")).toLowerCase().includes(busca.toLowerCase()));
  const coordsOk = form ? lerCoordenadas(form.coords) : null;

  return (
    <div>
      <TituloPagina
        titulo="Lojas"
        sub={`${lojas.filter((l) => l.ativa).length} ativas · o GPS do promotor é comparado com a posição de cada loja`}
        acao={<Botao onClick={() => { setErro(""); setForm({ ...vazio }); }}>+ Nova loja</Botao>}
      />
      {lojas.length > 5 && (
        <Entrada className="mb-4 max-w-sm" placeholder="Buscar loja…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      )}

      {!lojas.length ? (
        <Vazio titulo="Cadastre a primeira loja" texto="Dica: vá até a loja e use “Usar minha localização atual” — é o jeito mais preciso." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtradas.map((l) => (
            <Cartao key={l.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-stone-900">{l.nome}</p>
                {!l.ativa && <Selo>Inativa</Selo>}
              </div>
              <p className="mt-0.5 flex-1 text-sm text-stone-500">{l.endereco || "Sem endereço"}</p>
              <div className="mt-3 flex items-center justify-between text-sm">
                <a href={linkMapa(l.latitude, l.longitude)} target="_blank" rel="noreferrer" className="font-semibold text-marca-700">Ver no mapa · raio {l.raio_m} m</a>
                <button
                  className="font-semibold text-stone-600 hover:text-stone-900"
                  onClick={() => { setErro(""); setForm({ id: l.id, nome: l.nome, endereco: l.endereco ?? "", coords: `${l.latitude}, ${l.longitude}`, raio_m: l.raio_m, ativa: l.ativa }); }}
                >
                  Editar
                </button>
              </div>
            </Cartao>
          ))}
        </div>
      )}

      <Modal aberto={!!form} aoFechar={() => setForm(null)} titulo={form?.id ? "Editar loja" : "Nova loja"}>
        {form && (
          <form onSubmit={salvar} className="space-y-4">
            <Rotulo texto="Nome da loja">
              <Entrada value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Supermercado Bom Preço – Tijuca" required />
            </Rotulo>
            <Rotulo texto="Endereço (opcional)">
              <Entrada value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
            </Rotulo>
            <Rotulo texto="Coordenadas (latitude, longitude)"
                    dica="No Google Maps, segure o dedo sobre a loja e copie os números que aparecem. Ou esteja na loja e use o botão abaixo.">
              <Entrada value={form.coords} onChange={(e) => setForm({ ...form, coords: e.target.value })} placeholder="-22.906800, -43.172900" required />
            </Rotulo>
            <div className="flex flex-wrap items-center gap-3">
              <Botao type="button" variante="secundario" onClick={usarMinhaLocalizacao} carregando={pegandoGps}>📍 Usar minha localização atual</Botao>
              {coordsOk && <a href={linkMapa(coordsOk.lat, coordsOk.lng)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-marca-700">Conferir no mapa</a>}
            </div>
            <Rotulo texto={`Raio de tolerância: ${form.raio_m} m`} dica="Até essa distância a visita conta como “na loja”. Para lojas grandes ou GPS fraco, use 200–300 m.">
              <input type="range" min={50} max={1000} step={25} value={form.raio_m}
                     onChange={(e) => setForm({ ...form, raio_m: Number(e.target.value) })} className="w-full accent-marca-600" />
            </Rotulo>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={form.ativa} onChange={(e) => setForm({ ...form, ativa: e.target.checked })} className="h-4 w-4 accent-marca-600" />
              Loja ativa (aparece para os promotores)
            </label>
            {erro && <Aviso>{erro}</Aviso>}
            <div className="flex justify-end gap-2 pt-2">
              <Botao type="button" variante="fantasma" onClick={() => setForm(null)}>Cancelar</Botao>
              <Botao type="submit" carregando={salvando}>Salvar</Botao>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
