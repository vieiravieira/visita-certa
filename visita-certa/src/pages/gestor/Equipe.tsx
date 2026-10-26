import { useEffect, useState } from "react";
import { supabase, mensagemErro } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { fmtData } from "@/lib/formato";
import type { Perfil } from "@/lib/tipos";
import { Aviso, Botao, Cartao, Selo, TelaCarregando, TituloPagina, Vazio } from "@/components/ui";

export default function Equipe() {
  const { empresa, perfil } = useAuth();
  const [pessoas, setPessoas] = useState<Perfil[] | null>(null);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState("");

  const carregar = () =>
    supabase.from("perfis").select("*").order("nome").then(({ data }) => setPessoas((data as Perfil[]) ?? []));
  useEffect(() => { carregar(); }, []);

  async function alternar(p: Perfil) {
    setErro("");
    const { error } = await supabase.from("perfis").update({ ativo: !p.ativo }).eq("id", p.id);
    if (error) setErro(mensagemErro(error));
    carregar();
  }

  async function copiar(texto: string, qual: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
      setTimeout(() => setCopiado(""), 2000);
    } catch { /* navegador sem permissão */ }
  }

  if (!pessoas || !empresa) return <TelaCarregando />;
  const site = window.location.origin;
  const convite = `Olá! Para registrar suas visitas, acesse ${site}, toque em “Criar conta” e use o código ${empresa.codigo_promotor}.`;
  const promotores = pessoas.filter((p) => p.papel === "promotor");
  const gestores = pessoas.filter((p) => p.papel === "gestor");

  return (
    <div className="max-w-3xl">
      <TituloPagina titulo="Equipe" sub="Convide promotores e controle quem tem acesso" />

      <Cartao className="mb-6 overflow-hidden">
        <div className="bg-marca-800 px-5 py-4 text-white">
          <p className="text-sm text-marca-100">Código para novos promotores</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.2em]">{empresa.codigo_promotor}</p>
        </div>
        <div className="flex flex-wrap gap-2 p-4">
          <Botao variante="secundario" onClick={() => copiar(empresa.codigo_promotor, "codigo")}>{copiado === "codigo" ? "✓ Copiado" : "Copiar código"}</Botao>
          <Botao variante="secundario" onClick={() => copiar(convite, "convite")}>{copiado === "convite" ? "✓ Copiado" : "Copiar convite"}</Botao>
          <a href={`https://wa.me/?text=${encodeURIComponent(convite)}`} target="_blank" rel="noreferrer"
             className="inline-flex items-center rounded-xl bg-[#1fa855] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#178a45]">
            Enviar pelo WhatsApp
          </a>
        </div>
        <p className="px-4 pb-4 text-xs text-stone-500">
          Código para outro gestor da sua empresa: <span className="font-mono font-semibold">{empresa.codigo_gestor}</span> — não compartilhe com promotores.
        </p>
      </Cartao>

      {erro && <div className="mb-4"><Aviso>{erro}</Aviso></div>}

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Promotores ({promotores.filter((p) => p.ativo).length} ativos)</h2>
      {!promotores.length ? (
        <Vazio titulo="Nenhum promotor ainda" texto="Envie o convite acima. Quem criar conta com o código aparece aqui." />
      ) : (
        <Cartao className="mb-6 divide-y divide-stone-100">
          {promotores.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className={p.ativo ? "font-semibold text-stone-900" : "font-semibold text-stone-400"}>{p.nome}</p>
                <p className="truncate text-sm text-stone-500">{p.email} · desde {fmtData(p.criado_em)}</p>
              </div>
              <div className="flex items-center gap-3">
                {p.ativo ? <Selo cor="verde">Ativo</Selo> : <Selo>Bloqueado</Selo>}
                <Botao variante={p.ativo ? "perigo" : "secundario"} onClick={() => alternar(p)}>{p.ativo ? "Bloquear" : "Reativar"}</Botao>
              </div>
            </div>
          ))}
        </Cartao>
      )}

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Gestores</h2>
      <Cartao className="divide-y divide-stone-100">
        {gestores.map((g) => (
          <div key={g.id} className="px-4 py-3">
            <p className="font-semibold text-stone-900">{g.nome} {g.id === perfil?.id && <span className="text-sm font-normal text-stone-500">(você)</span>}</p>
            <p className="text-sm text-stone-500">{g.email}</p>
          </div>
        ))}
      </Cartao>
    </div>
  );
}
