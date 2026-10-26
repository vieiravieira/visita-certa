# Visita Certa

Sistema para promotores de mercado registrarem visitas às lojas pelo celular. Cada visita leva **foto obrigatória**, **localização GPS** e **checklist**. O cliente que assina o sistema acompanha tudo num painel.

**Tecnologias:** React + Vite + TypeScript + Tailwind, com Supabase (login, banco e fotos). Hospedagem na Vercel.

---

## Quem usa o quê

| Perfil | Quem é | O que faz |
|---|---|---|
| **Admin** | Você (dona do sistema) | Cadastra clientes, controla a mensalidade, bloqueia quem não pagar |
| **Gestor** | O cliente que paga | Cadastra lojas e perguntas, convida promotores, vê as visitas e exporta o relatório |
| **Promotor** | Funcionário do cliente | Registra visitas: loja, fotos, checklist e observação |

Cada cliente só vê os dados dele. Essa separação é garantida pelo banco de dados, não só pela tela.

---

## Passo a passo para colocar no ar (tudo grátis)

### 1. Supabase (banco de dados)

1. Crie uma conta em <https://supabase.com> e clique em **New project**. Escolha a região **South America (São Paulo)**.
2. No menu lateral, abra **SQL Editor**, clique em **New query**, cole todo o conteúdo do arquivo `supabase/schema.sql` e clique em **Run**. O resultado deve ser "Success".
3. Em **Authentication → Sign In / Providers → Email**, **desligue "Confirm email"**. Assim o promotor entra direto, sem precisar confirmar o e-mail. Se preferir manter ligado, também funciona: ele só vai precisar clicar no link que chega por e-mail.
4. Em **Project Settings → API**, copie dois valores:
   - **Project URL**
   - **anon public key**

### 2. GitHub

1. Crie um repositório novo em <https://github.com/new> (pode ser privado).
2. Envie esta pasta para ele. Pelo site, use **"uploading an existing file"** e arraste todos os arquivos, **exceto** a pasta `node_modules`. Pelo terminal:
   ```bash
   git remote add origin https://github.com/SEU-USUARIO/visita-certa.git
   git push -u origin main
   ```

### 3. Vercel (site no ar)

1. Em <https://vercel.com>, clique em **Add New → Project** e importe o repositório.
2. Em **Environment Variables**, cadastre:
   - `VITE_SUPABASE_URL` = a Project URL
   - `VITE_SUPABASE_ANON_KEY` = a anon public key
3. Clique em **Deploy**. Em cerca de 1 minuto você recebe um endereço, por exemplo `visita-certa.vercel.app`.

### 4. Criar sua conta de administradora

1. Abra o site, clique em **Criar conta** e, no código de acesso, digite **`ADMIN`**.
2. Isso só funciona **uma vez**: a primeira conta com esse código vira administradora, e depois o código deixa de valer.

### 5. Cadastrar o primeiro cliente

1. Logada como admin, clique em **+ Novo cliente**.
2. O sistema gera dois códigos:
   - **Código do gestor (G…)**: envie ao cliente. Ele cria a conta com esse código.
   - **Código dos promotores (P…)**: o gestor encontra esse código na aba **Equipe**, onde há um botão para enviar o convite pelo WhatsApp.
3. Para bloquear um cliente que não pagou, edite o cliente e desmarque **Empresa ativa**. O gestor e os promotores dele perdem o acesso na hora.

---

## Como funciona cada regra

- **"Foi na loja ou não"**: o gestor cadastra as coordenadas de cada loja e um raio de tolerância, que por padrão é 200 m. No envio, o **servidor** calcula a distância entre o promotor e a loja e grava "Na loja" ou "Fora da loja". O celular não decide isso, então não dá para burlar pela tela.
- **Foto obrigatória**: o banco recusa uma visita sem foto e confere se cada foto existe de verdade no armazenamento. O app abre direto a câmera traseira.
- **Data e hora**: vêm do servidor, não do relógio do celular.
- **Fotos leves**: o app reduz cada foto para cerca de 200 KB antes de enviar. Assim o 1 GB grátis do Supabase comporta milhares de fotos.
- **Histórico**: as visitas não podem ser editadas nem apagadas por gestores ou promotores.
- **Perguntas**: se o gestor mudar ou apagar uma pergunta, as respostas antigas continuam no histórico com o texto original.

### Limitações (seja transparente com o cliente)

- O GPS pode ser falsificado com aplicativos específicos de "localização falsa". O sistema registra a precisão do GPS, o que ajuda a identificar casos suspeitos, mas não é antifraude.
- Alguns celulares deixam escolher foto da galeria mesmo com a câmera aberta.
- É preciso ter internet no momento do envio.

---

## Instalar no celular como app

Abra o site no celular:
- **Android (Chrome):** menu ⋮ → **Adicionar à tela inicial**
- **iPhone (Safari):** botão compartilhar → **Adicionar à Tela de Início**

---

## Rodar no seu computador (opcional)

```bash
npm install
cp .env.example .env.local   # e preencha com os valores do Supabase
npm run dev
```

---

## Quando vender (custos)

| Serviço | Grátis | Quando pagar |
|---|---|---|
| Vercel | Plano Hobby: uso **não comercial** | Assim que cobrar do primeiro cliente: Pro, US$ 20/mês |
| Supabase | 500 MB de banco, 1 GB de fotos, pausa após 7 dias sem uso | Quando tiver cliente real: Pro, US$ 25/mês, sem pausa e com 100 GB de fotos |

> No plano grátis, o Supabase pausa o projeto se ficar uma semana sem uso. Os dados não se perdem: é só entrar no painel do Supabase e clicar em **Restore**. Antes de uma demonstração, abra o sistema um dia antes.

---

## Estrutura do código

```
supabase/schema.sql          Banco de dados completo (tabelas, segurança, funções)
src/lib/                     Conexão com o Supabase, GPS, compressão de foto, formatos
src/components/              Peças visuais reutilizáveis e o detalhe da visita
src/pages/Login.tsx          Entrar e criar conta com código
src/pages/promotor/          Nova visita e histórico
src/pages/gestor/            Visitas (painel), lojas, checklist e equipe
src/pages/admin/             Clientes (empresas)
```
