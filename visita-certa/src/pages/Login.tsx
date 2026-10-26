import { useState, type FormEvent } from "react";
import { supabase, mensagemErro } from "@/lib/supabase";
import { Aviso, Botao, Entrada, Rotulo, cx } from "@/components/ui";
import { Logo } from "@/components/Layout";

const nomesPapel: Record<string, string> = { gestor: "gestor", promotor: "promotor", admin: "administrador do sistema" };

export default function Login() {
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoOk, setCodigoOk] = useState<{ empresa: string; papel: string } | null>(null);
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function conferirCodigo() {
    setErro("");
    setCodigoOk(null);
    if (!codigo.trim()) return;
    const { data, error } = await supabase.rpc("validar_codigo", { p_codigo: codigo });
    if (error) return setErro(mensagemErro(error));
    const linha = (data as { empresa: string; papel: string }[] | null)?.[0];
    if (!linha) return setErro("Código não encontrado. Confira com quem te passou o acesso.");
    setCodigoOk(linha);
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setInfo("");
    setEnviando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) throw error;
      } else {
        if (!codigoOk) {
          await conferirCodigo();
          throw new Error("Confira o código de acesso antes de continuar.");
        }
        if (nome.trim().length < 3) throw new Error("Digite seu nome completo.");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { data: { nome: nome.trim(), codigo: codigo.trim().toUpperCase() } },
        });
        if (error) throw error;
        if (!data.session) {
          setInfo("Conta criada! Abra o e-mail que enviamos e clique no link de confirmação. Depois volte aqui e entre.");
          setModo("entrar");
        }
      }
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <section className="relative overflow-hidden bg-marca-800 px-6 pb-10 pt-8 text-white lg:flex lg:w-[44%] lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-marca-600/40 blur-2xl" />
        <Logo claro />
        <div className="relative mt-8 lg:mt-0">
          <h1 className="text-3xl font-bold leading-tight lg:text-4xl">Cada visita comprovada,<br className="hidden lg:block" /> com foto e localização.</h1>
          <p className="mt-3 max-w-md text-marca-100">
            O promotor registra a visita na loja pelo celular. Você acompanha tudo em tempo real: quem foi, quando, onde e como estava a gôndola.
          </p>
        </div>
        <ul className="relative mt-6 hidden space-y-2 text-sm text-marca-100 lg:block">
          <li>✓ GPS confere se o promotor estava na loja</li>
          <li>✓ Foto obrigatória, tirada na hora</li>
          <li>✓ Checklist personalizado e relatório em Excel</li>
        </ul>
      </section>

      <section className="flex flex-1 items-start justify-center px-5 py-8 lg:items-center">
        <div className="w-full max-w-sm">
          <div className="mb-6 grid grid-cols-2 rounded-xl bg-stone-200/70 p-1">
            {(["entrar", "cadastrar"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setModo(m); setErro(""); setInfo(""); }}
                className={cx("rounded-lg py-2 text-sm font-semibold transition", modo === m ? "bg-white text-stone-900 shadow-sm" : "text-stone-600")}
              >
                {m === "entrar" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form onSubmit={enviar} className="space-y-4">
            {modo === "cadastrar" && (
              <>
                <Rotulo texto="Código de acesso" dica="Recebido da sua empresa. Ex.: P4F9A21">
                  <div className="flex gap-2">
                    <Entrada
                      value={codigo}
                      onChange={(e) => { setCodigo(e.target.value.toUpperCase()); setCodigoOk(null); }}
                      onBlur={conferirCodigo}
                      placeholder="Código"
                      autoCapitalize="characters"
                      className="uppercase tracking-widest"
                      required
                    />
                    <Botao type="button" variante="secundario" onClick={conferirCodigo}>Conferir</Botao>
                  </div>
                </Rotulo>
                {codigoOk && (
                  <Aviso tipo="sucesso">
                    Você vai entrar como <b>{nomesPapel[codigoOk.papel]}</b> em <b>{codigoOk.empresa}</b>.
                  </Aviso>
                )}
                <Rotulo texto="Nome completo">
                  <Entrada value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required />
                </Rotulo>
              </>
            )}
            <Rotulo texto="E-mail">
              <Entrada type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required />
            </Rotulo>
            <Rotulo texto="Senha" dica={modo === "cadastrar" ? "Mínimo de 6 caracteres" : undefined}>
              <Entrada
                type="password" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={6}
                autoComplete={modo === "entrar" ? "current-password" : "new-password"} required
              />
            </Rotulo>

            {erro && <Aviso>{erro}</Aviso>}
            {info && <Aviso tipo="info">{info}</Aviso>}

            <Botao type="submit" carregando={enviando} className="w-full py-3">
              {modo === "entrar" ? "Entrar" : "Criar minha conta"}
            </Botao>
          </form>
        </div>
      </section>
    </div>
  );
}
