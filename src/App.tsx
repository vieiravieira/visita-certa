import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { supabaseConfigurado } from "./lib/supabase";
import { Layout, Icones } from "./components/Layout";
import { Botao, TelaCarregando } from "./components/ui";
import Login from "./pages/Login";
import NovaVisita from "./pages/promotor/NovaVisita";
import MinhasVisitas from "./pages/promotor/MinhasVisitas";
import Visitas from "./pages/gestor/Visitas";
import Lojas from "./pages/gestor/Lojas";
import Perguntas from "./pages/gestor/Perguntas";
import Equipe from "./pages/gestor/Equipe";
import Empresas from "./pages/admin/Empresas";

export default function App() {
  const { carregando, sessao, perfil, empresa, sair } = useAuth();

  if (!supabaseConfigurado) {
    return (
      <Recado titulo="Falta configurar o Supabase">
        Cadastre as variáveis <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> (veja o README) e publique de novo.
      </Recado>
    );
  }
  if (carregando) return <TelaCarregando />;
  if (!sessao) return <Login />;
  if (!perfil) {
    return (
      <Recado titulo="Conta sem acesso" acao={<Botao onClick={sair}>Sair</Botao>}>
        Sua conta ainda não está ligada a nenhuma empresa. Fale com o responsável que te passou o código.
      </Recado>
    );
  }
  if (!perfil.ativo) {
    return (
      <Recado titulo="Acesso bloqueado" acao={<Botao onClick={sair}>Sair</Botao>}>
        Seu acesso foi desativado pelo gestor. Se for engano, fale com ele.
      </Recado>
    );
  }
  if (perfil.papel !== "admin" && empresa && !empresa.ativa) {
    return (
      <Recado titulo="Assinatura suspensa" acao={<Botao onClick={sair}>Sair</Botao>}>
        O acesso de <b>{empresa.nome}</b> está suspenso. Entre em contato com o suporte para regularizar.
      </Recado>
    );
  }

  if (perfil.papel === "promotor") {
    return (
      <Routes>
        <Route element={<Layout inferiorNoCelular itens={[
          { para: "/", rotulo: "Nova visita", icone: Icones.camera },
          { para: "/historico", rotulo: "Histórico", icone: Icones.historico },
        ]} />}>
          <Route index element={<NovaVisita />} />
          <Route path="historico" element={<MinhasVisitas />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  if (perfil.papel === "gestor") {
    return (
      <Routes>
        <Route element={<Layout itens={[
          { para: "/", rotulo: "Visitas", icone: Icones.visitas },
          { para: "/lojas", rotulo: "Lojas", icone: Icones.loja },
          { para: "/checklist", rotulo: "Checklist", icone: Icones.pergunta },
          { para: "/equipe", rotulo: "Equipe", icone: Icones.pessoas },
        ]} />}>
          <Route index element={<Visitas />} />
          <Route path="lojas" element={<Lojas />} />
          <Route path="checklist" element={<Perguntas />} />
          <Route path="equipe" element={<Equipe />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout itens={[{ para: "/", rotulo: "Clientes", icone: Icones.empresa }]} />}>
        <Route index element={<Empresas />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function Recado({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md text-center">
        <img src="/icon.svg" alt="" className="mx-auto h-14 w-14" />
        <h1 className="mt-4 text-xl font-bold text-stone-900">{titulo}</h1>
        <p className="mt-2 text-stone-600">{children}</p>
        {acao && <div className="mt-6">{acao}</div>}
      </div>
    </div>
  );
}
