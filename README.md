# RaroNexus — Identity Provider & Central de Serviços Rarotec

O **RaroNexus** é o Identity Provider (IdP) corporativo da **Rarotec**. É responsável por centralizar a autenticação, controle de sessões globais (SSO), permissões de acesso, catálogo de aplicações e envio transacional de e-mails para todo o ecossistema da empresa.

O sistema atua como o ponto focal de identidade, autorização e integração para sistemas satélites.

---

## 🚀 Principais Módulos

- **Autenticação Centralizada & SSO**: Emissão e validação de `global_session_token`, login único com suporte a popup interativo e verificação silenciosa via `iframe`, além de fluxos de recuperação e redefinição de senhas.
- **Administração de Usuários & Convites**: Gestão de colaboradores com onboarding seguro por convite, criando `auth.users` e `public.users` apenas após a conclusão do cadastro com validação de CPF único.
- **Catálogo de Aplicações & Permissões**: Cadastro de sistemas clientes (`applications`), definição de papéis e cargos por aplicativo (`application_roles`) e controle de acesso individual (`user_applications`).
- **Perfil do Usuário**: Gestão centralizada de dados cadastrais, cargo, foto/avatar e alteração de credenciais.
- **Hub Transacional de E-mails**: Serviço centralizado de disparo de e-mails com templates HTML dinâmicos para atendimento às aplicações satélites do ecossistema.
- **APIs & Constantes Centralizadas**: Endpoints RESTful versionados para constantes do ecossistema, e-mails e gerenciamento de aplicações com DTOs tipados e validação Zod.

---

## 🛠️ Stack Tecnológica

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Biblioteca UI**: [React 19](https://react.dev/)
- **Estilização**: Tailwind CSS v4, Lucide Icons
- **Linguagem**: TypeScript 5
- **Autenticação & Banco de Dados**: Supabase Auth + PostgreSQL com Row Level Security (RLS)
- **Validação de Dados**: Zod
- **E-mails**: Nodemailer + SMTP corporativo

---

## 💻 Instalação e Execução

### Pré-requisitos
- Node.js 20+ ou 22 LTS
- Gerenciador de pacotes `npm`
- Projeto configurado no Supabase com migrations aplicadas (`supabase/migrations/`)

### 1. Instalar Dependências
```bash
npm install
```

### 2. Executar em Desenvolvimento
```bash
npm run dev
```
> O servidor será iniciado automaticamente na porta `3001` (`http://localhost:3001`).

### 3. Verificar Tipagem e Qualidade
```bash
npm run typecheck
npm run lint
npm run test
```

### 4. Build de Produção
```bash
npm run build
npm run start
```

---

## 🔐 Papel no Ecossistema e Fluxo SSO

1. O **RaroNexus** é a autoridade central de identidade da Rarotec; nenhuma aplicação satélite gerencia credenciais de senha diretamente.
2. Aplicações clientes registram suas credenciais (`client_id` e `client_secret`) e URLs de callback autorizadas no Nexus.
3. Ao logar em qualquer sistema satélite, a sessão é conferida pelo endpoint `/api/v1/sessions/introspect`.
4. Usuários autorizados para cada aplicação são sincronizados em lote via `/api/v1/applications/authorized-users`.
