# Guia de Integração: Módulo de Auditoria Corporativa do RaroNexus

Este guia foi elaborado para orientar **agentes de IA** e desenvolvedores de projetos satélites a integrarem e implementarem nativamente o registro de auditoria corporativa em qualquer funcionalidade nova ou refatorada do ecossistema **RaroTec**, garantindo padronização, conformidade legal com a LGPD e integridade criptográfica matemática.

---

## 1. Visão Geral e Princípios Arquiteturais

O ecossistema RaroTec adota um modelo de **Auditoria Unificada Distribuída (Hub-and-Spoke)**. Nenhuma plataforma satélite grava diretamente no banco de dados analítico central, prevenindo acoplamento, gargalos de rede e bloqueios de I/O em operações do usuário.

```
[ Aplicação Satélite 1 ] ---\
[ Aplicação Satélite 2 ] ----+--> [ Upstash Redis: Stream ] ---> [ Worker / AutoDrain ] ---> [ MongoDB Atlas ]
[ Plataforma RaroNexus ] ---/       (Airbag Buffer ~100k)           (Lock Distribuído)          (rarotec_audit)
                                                                            |
                                                                  [ Cripto Hash Chaining ]
                                                                  [ SHA-256 por Sistema ]
```

### Pilares Fundamentais:
1. **Airbag Buffer Desacoplado (Upstash Redis Stream)**:
   - Toda emissão de log grava em milissegundos no stream `audit_events_stream` no Redis.
   - A resposta da aplicação satélite ao usuário final **nunca é travada** nem sofre lentidão caso o banco de dados analítico esteja indisponível ou em manutenção (p95 < 50ms).
   - O stream possui retenção aproximada `MAXLEN ~ 100.000` para salvaguarda de cotas.

2. **Drenagem Centralizada com Lock Atômico Distribuído**:
   - O processamento em lote da fila para o banco final é executado no RaroNexus via rotina `drainAuditBatch`.
   - Uma trava atômica distribuída (`SET NX EX 20` na chave `audit:drain:lock`) garante que múltiplas instâncias ou execuções concorrentes (ex.: Cron do QStash e AutoDrain de tela) nunca processem o mesmo lote simultaneamente.
   - Duplicatas legítimas são tratadas com idempotência cirúrgica via `MongoBulkWriteError` (`ordered: false`), e payloads corrompidos são isolados na **Dead-Letter Queue (DLQ)** (`audit_events_dlq`).

3. **Integridade Criptográfica Contínua (Hash Chaining SHA-256)**:
   - Cada evento é assinado matematicamente gerando um hash determinístico SHA-256 a partir da ordenação canônica de suas propriedades (`canonicalStringify`).
   - O hash do evento anterior (`prevHash`) de cada sistema é mantido atomicamente no Redis (`audit:last_hash:{system}`) com fallback para o MongoDB Atlas, formando uma cadeia contínua à prova de adulteração (*tamper-evident*).

4. **Padrão Outbox Relay para Plataformas com Banco Relacional Local**:
   - Em plataformas que possuem banco local (ex.: PostgreSQL no RaroTickets), os registros são gravados na tabela local `audit_logs` e recebem uma coluna `forwarded_at`.
   - Se ocorrer oscilação temporária de rede com o Redis, o log fica com `forwarded_at = NULL` e o método `relayPending()` retransmite as pendências de forma transparente no próximo ciclo de requisições.

5. **Disparos do Dreno (Cron QStash + AutoDrain)**:
   - Em produção, um Cron no **Upstash QStash** aciona `POST /api/cron/drain-audit` a cada 3 minutos.
   - Em desenvolvimento e homologação (ou contingência), o **AutoDrain** roda automaticamente sempre que um administrador abre a tela de auditoria no RaroNexus (`/admin/audit`).

---

## 2. O Que DEVE e o Que NÃO DEVE Ser Auditado (Regras Universais)

> [!IMPORTANT]
> **A Regra de Ouro da Auditoria**:
> *Audite Mutações de Estado e Eventos Críticos de Segurança; NUNCA audite Consultas, Navegações ou Downloads de Relatórios.*

Esta diretriz é **genérica e obrigatória** para qualquer sistema presente ou futuro do ecossistema.

### 2.1. O que DEVE ser auditado (Obrigatório)

Qualquer ação que **crie, modifique, desative ou exclua dados**, que **transacione valores**, que **altere configurações globais** ou que envolva **segurança e credenciais**:

| Categoria | Descrição da Operação | Padrão da Ação (`action`) | Severidade Típica |
| :--- | :--- | :--- | :---: |
| **Criação de Entidade** | Cadastro de um novo registro no banco de dados. | `entidade.created` | `INFO` |
| **Atualização de Dados** | Alteração em dados cadastrais, itens, limites ou metadados. | `entidade.updated` | `INFO` |
| **Exclusão de Entidade** | Remoção física ou lógica de um registro de negócio. | `entidade.deleted` | `WARNING` |
| **Transição de Status** | Mudança no ciclo de vida de uma entidade (aprovação, rejeição, cancelamento, ativação, encerramento). | `entidade.status_changed` / `entidade.approved` / `entidade.cancelled` | `INFO` / `WARNING` |
| **Autenticação e Sessão** | Login sucedido, tentativa com senha errada, logout voluntário ou revogação forçada de sessão. | `auth.login_succeeded` / `auth.login_failed` / `auth.logout` / `session.revoked` | `INFO` / `WARNING` |
| **Gestão de Acessos** | Concessão ou remoção de papéis, privilégios, convites de novos usuários e autorizações SSO. | `user.invited` / `user.role_updated` / `sso.authorized` | `INFO` / `WARNING` |
| **Operações Financeiras** | Liquidação de pagamentos, estornos/reembolsos, alteração de dados bancários/PIX, regras de adiantamento e concessão de gratuidades/cortesias. | `payment.confirmed` / `payment.refund_requested` / `banking.updated` / `courtesy.granted` | `INFO` / `WARNING` / `CRITICAL` |
| **Patrimônio e Almoxarifado** | Retirada/cautela de equipamento, devolução, transferência, entrada por NF e baixa de estoque de consumo. | `equipment.obtained` / `equipment.returned` / `stock.issue` / `stock.acquisition` | `INFO` / `WARNING` |
| **Comunicação Oficial** | Envio de propostas a clientes, emissão formal de certidões/certificados e relatórios técnicos enviados a órgãos externos. | `proposal.sent_by_email` / `certificate.issued` / `report.sent_by_email` | `INFO` |
| **Configurações do Sistema** | Ligar/desligar módulos institucionais, alterar parâmetros globais ou limites operacionais. | `config.updated` / `system_module.status_changed` | `WARNING` |

---

### 2.2. O que NUNCA DEVE ser auditado (Proibido)

Para preservar armazenamento no MongoDB Atlas, poupar largura de banda no Upstash Redis e evitar ruído desnecessário no painel de conformidade, **NUNCA emita logs para**:

1. **Leituras e Consultas Simples (`GET`)**:
   - Abertura de telas, visualização de tabelas, carregamento de detalhes de registro.
   - Navegação paginada, buscas com filtros e autocompletes.
   - Endpoints de *health-check*, status de rotas e verificações de versão.
2. **Downloads e Exportações de Arquivos**:
   - Geração e download de relatórios em PDF, planilhas CSV/Excel ou impressão de páginas HTML.
   - *(Motivo: Não realizam nenhuma mutação de banco de dados e gerariam milhares de eventos descartáveis diariamente).*
3. **Consultas Públicas ou a APIs Externas**:
   - Consulta de CNPJ em serviços externos (ReceitaWS, BrasilAPI).
   - Consulta de CEP, geolocalização ou cálculo de rotas em mapas (Nominatim, OSRM).
   - Leitura pública de QR Code de autenticidade.
4. **Visualizações do Próprio Console de Auditoria**:
   - Não emita `audit.viewed` ao abrir a tela de logs ou paginar registros de auditoria.
5. **Estados Temporários de Interface**:
   - Marcar notificações do sininho como "lida" (`notification.read`).
   - Rascunhos temporários de formulário salvos apenas em sessão local.
6. **Upload Temporário de Arquivos no Storage**:
   - O upload do arquivo bruto no bucket não deve auditar. A auditoria deve ser disparada apenas quando o registro de negócio ao qual o arquivo pertence for efetivamente salvo ou alterado.

---

## 3. Estrutura do Envelope Canônico de Auditoria

Todo evento emitido por uma plataforma deve obedecer estritamente à interface do envelope corporativo:

```typescript
export interface AuditEnvelopeInput {
  // Identificação e Roteamento
  system?: string;                     // Identificador canônico da plataforma (ex: "raropay", "rarotickets")
  category: string;                   // Categoria de negócio (ex: "finance", "auth", "stock", "contract")
  action: string;                     // Verbo no padrão entidade.acao_no_passado (ex: "expense.approved")
  severity?: "INFO" | "WARNING" | "CRITICAL"; // Padrão: "INFO"
  status?: "SUCCESS" | "FAILURE";     // Padrão: "SUCCESS"
  correlationId?: string;             // UUID de correlação entre microsserviços (opcional)

  // Autoria (Quem realizou a ação)
  actor: {
    type: "user" | "system" | "anonymous";
    userId?: string;                  // ID do usuário autenticado
    name?: string;                    // Nome amigável do usuário
    email?: string;                   // E-mail corporativo
    role?: string | null;             // Papel/cargo do usuário (ex: "GESTOR", "ADMIN")
    systemName?: string;              // Obrigatório se type="system" (ex: "cron.drain", "pagbank.webhook")
  };

  // Alvos (Quais entidades de negócio foram afetadas)
  targets: Array<{
    type: string;                     // Nome da entidade (ex: "expense", "equipment", "event")
    id: string;                       // Identificador ou código da entidade
    label?: string;                   // Rótulo legível (ex: "Despesa #1234 - Viagem SP")
  }>;

  // Contexto de Rede
  context?: {
    ip: string | null;                // IP de origem do cliente
    userAgent?: string | null;        // User-Agent do navegador/cliente HTTP
    sessionId?: string | null;        // Identificador da sessão ativa
  };

  // Rastreamento de Alterações (Obrigatório em atualizações de dados)
  diff?: {
    before: Record<string, unknown>;  // Estado dos campos ANTES da mutação
    after: Record<string, unknown>;   // Estado dos campos DEPOIS da mutação
  };

  // Metadados Adicionais Relevantes
  details?: Record<string, unknown>;  // Dados complementares para enriquecer a consulta
}
```

### Regras para a Nomenclatura de `action`:
- Use sempre letras minúsculas com separação por ponto: `entidade.acao`.
- A ação deve estar expressa no **passado / particípio em inglês** para manter consistência internacional:
  - Correto: `user.created`, `expense.approved`, `equipment.returned`, `contract.cancelled`.
  - Incorreto: `criar_usuario`, `approveExpense`, `RETURN_EQUIPMENT`.

---

## 4. Proteção de Dados e Conformidade com a LGPD

O módulo inclui um sanitizador recursivo profundo ([`sanitizer.ts`](file:///d:/_RaroSpace/raronexus/src/lib/audit/sanitizer.ts)) que atua em conformidade com o Art. 6º, III (Princípio da Necessidade) e Art. 5º, II da LGPD. 

Ao preencher `details` ou `diff`, o desenvolvedor ou agente deve estar ciente das regras automáticas de higienização:

1. **Chaves Sensíveis são Substituídas por `[REDACTED]`**:
   - Qualquer campo cujo nome contenha: `password`, `senha`, `token`, `secret`, `authorization`, `credit_card`, `cartao_credito`, `cvv`, `cvc`, `private_key`, `api_key`, `access_token`, `refresh_token`, `pin`.
   - **Regra**: Nunca tente contornar renomeando chaves sensíveis. Não trafegue senhas e tokens na auditoria.
2. **Mascaramento Automático em Texto Livre**:
   - **CPFs**: Convertidos para `***.456.789-**` (preserva apenas os dígitos centrais para conferência segura).
   - **Cartões de Crédito**: Convertidos para `**** **** **** 1234` (preserva apenas os 4 últimos dígitos).
3. **Proteção contra Sobrecarga de Memória**:
   - Profundidade máxima de 3 níveis (`maxDepth = 3`). Níveis superiores recebem `[MAX_DEPTH_REACHED]`.
   - Strings com mais de 4096 caracteres são truncadas com `... [TRUNCATED]`.

---

## 5. Como Integrar uma Nova Plataforma Satélite

Ao criar uma nova plataforma ou integrar um projeto existente à auditoria unificada, siga o procedimento abaixo:

### Passo 1: Variáveis de Ambiente no `.env.example`
A aplicação satélite precisa apenas do cliente do Upstash Redis:

```env
# Upstash Redis (Airbag Buffer de Auditoria Corporativa)
UPSTASH_REDIS_REST_URL="https://patient-antelope-235008.upstash.io"
UPSTASH_REDIS_REST_TOKEN="seu_upstash_redis_rest_token_aqui"
```

### Passo 2: Estrutura do Pacote de Auditoria Local
Copie o módulo padronizado de auditoria para a pasta `src/lib/audit` (ou `lib/audit`) da sua aplicação:

```
src/lib/audit/
├── client.ts       # Classe AuditClient com métodos log() e buildEnvelope()
├── hash.ts         # Cálculo determinístico SHA-256 com canonicalStringify
├── queue.ts        # Enfileiramento assíncrono no stream audit_events_stream
├── sanitizer.ts    # Sanitização LGPD (redação de segredos e mascaramento)
├── tokens.ts       # Extração de tokens normalizados para pesquisa textual
├── types.ts        # Interfaces AuditEnvelope, AuditEnvelopeInput, AuditActor
├── uuid.ts         # Gerador de UUIDv7 sequencial e temporal
└── index.ts        # Exportação pública e função getRequestContext(request)
```

### Passo 3: Registrar a Identidade Visual no RaroNexus
No painel do RaroNexus ([`audit-admin.tsx`](file:///d:/_RaroSpace/raronexus/src/components/admin/audit-admin.tsx#L54-L91)), adicione o identificador e a paleta de cores da nova plataforma no objeto `SYSTEM_LABELS`:

```typescript
minhanovaplataforma: {
  label: "Minha Plataforma",
  color: "text-indigo-300",
  border: "border-indigo-500/30",
  bg: "bg-indigo-500/10",
},
```

---

## 6. Exemplos Práticos de Código

### 6.1. Exemplo de Criação (`entidade.created`) em Route Handler Next.js

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { auditClient, getRequestContext } from "@/lib/audit";
import { db } from "@/lib/db";
import { orders } from "@/lib/schema";

export async function POST(request: NextRequest) {
  const user = await getSession(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const [createdOrder] = await db.insert(orders).values({
    clientId: body.clientId,
    totalCents: body.totalCents,
    createdBy: user.id,
  }).returning();

  // Emissão de auditoria não-bloqueante
  auditClient.log({
    category: "orders",
    action: "order.created",
    severity: "INFO",
    actor: {
      type: "user",
      userId: String(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
    },
    targets: [
      {
        type: "order",
        id: String(createdOrder.id),
        label: `Pedido #${createdOrder.id} - R$ ${(createdOrder.totalCents / 100).toFixed(2)}`,
      },
    ],
    context: getRequestContext(request),
    details: {
      clientId: createdOrder.clientId,
      totalCents: createdOrder.totalCents,
    },
  });

  return NextResponse.json(createdOrder, { status: 201 });
}
```

---

### 6.2. Exemplo de Atualização com Rastreamento de Diff (`entidade.updated`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { auditClient, getRequestContext } from "@/lib/audit";
import { db } from "@/lib/db";
import { clients } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const [beforeClient] = await db.select().from(clients).where(eq(clients.id, params.id)).limit(1);
  if (!beforeClient) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const [afterClient] = await db.update(clients)
    .set({
      corporateName: body.corporateName,
      contactEmail: body.contactEmail,
      creditLimitCents: body.creditLimitCents,
      updatedAt: new Date(),
    })
    .where(eq(clients.id, params.id))
    .returning();

  auditClient.log({
    category: "clients",
    action: "client.updated",
    severity: "INFO",
    actor: {
      type: "user",
      userId: String(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
    },
    targets: [
      {
        type: "client",
        id: String(afterClient.id),
        label: afterClient.corporateName,
      },
    ],
    context: getRequestContext(request),
    diff: {
      before: {
        corporateName: beforeClient.corporateName,
        contactEmail: beforeClient.contactEmail,
        creditLimitCents: beforeClient.creditLimitCents,
      },
      after: {
        corporateName: afterClient.corporateName,
        contactEmail: afterClient.contactEmail,
        creditLimitCents: afterClient.creditLimitCents,
      },
    },
  });

  return NextResponse.json(afterClient);
}
```

---

### 6.3. Exemplo de Ação de Sistema / Webhook Assíncrono (`system`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auditClient } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  // ... validação de assinatura de webhook do gateway ...

  auditClient.log({
    category: "payments",
    action: "payment.webhook_received",
    severity: payload.status === "REFUNDED" ? "WARNING" : "INFO",
    actor: {
      type: "system",
      systemName: "gateway.pagbank_webhook",
    },
    targets: [
      {
        type: "payment_transaction",
        id: payload.transactionId,
        label: `Transação ${payload.transactionId} (${payload.status})`,
      },
    ],
    context: {
      ip: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || null,
      userAgent: request.headers.get("user-agent") || null,
    },
    details: {
      gatewayStatus: payload.status,
      grossAmountCents: payload.grossAmountCents,
    },
  });

  return NextResponse.json({ received: true });
}
```

---

## 7. Padrão Outbox Relay para Plataformas com Banco Local

Se a sua aplicação possui um banco de dados relacional próprio e exige **tolerância total a falhas** (por exemplo, garantia de entrega mesmo se a conexão externa com a internet ou o Redis cair por horas):

1. **Adicione a coluna `forwarded_at` na tabela local de auditoria**:
   ```sql
   ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "forwarded_at" timestamp with time zone;
   CREATE INDEX IF NOT EXISTS "audit_logs_forwarded_idx" ON "audit_logs" ("forwarded_at");
   ```
2. **Grave no banco local primeiro e despache para o Redis**:
   ```typescript
   // 1. Gravação local síncrona
   const [inserted] = await db.insert(auditLogs).values({ ...params }).returning({ id: auditLogs.id });

   // 2. Transmissão para a fila do Nexus
   const sent = await auditClient.log(envelope);
   if (sent && inserted?.id) {
     await db.update(auditLogs).set({ forwardedAt: new Date() }).where(eq(auditLogs.id, inserted.id));
   }
   ```
3. **Implemente o método `relayPending` para retransmissão periódica**:
   ```typescript
   async function relayPending(limit = 50): Promise<number> {
     const pending = await db.select().from(auditLogs)
       .where(isNull(auditLogs.forwardedAt))
       .orderBy(asc(auditLogs.createdAt))
       .limit(limit);

     let relayed = 0;
     for (const record of pending) {
       const sent = await auditClient.log(buildEnvelope(record));
       if (sent) {
         await db.update(auditLogs).set({ forwardedAt: new Date() }).where(eq(auditLogs.id, record.id));
         relayed++;
       } else {
         break; // Interrompe para preservar a ordenação cronológica
       }
     }
     return relayed;
   }
   ```

---

## 8. Checklist Obrigatório para Agentes de IA e Desenvolvedores

Ao planejar, codificar ou refatorar qualquer funcionalidade no ecossistema RaroTec, execute esta lista de checagem mental antes de considerar a tarefa concluída:

- [ ] **Ação Relevante**: A funcionalidade realiza alguma mutação no banco de dados (`INSERT`, `UPDATE`, `DELETE`), transição de status ou operação de segurança/finanças? Se **SIM**, a auditoria é **obrigatória**.
- [ ] **Sem Ruído**: A rota é de leitura (`GET`), consulta, busca ou download de relatório/PDF/CSV? Se **SIM**, **NÃO** emita log de auditoria.
- [ ] **Nomenclatura**: A ação segue o padrão `entidade.acao_no_passado` (ex: `invoice.approved`)?
- [ ] **Autoria**: O `actor` identifica o usuário autenticado da sessão (`id`, `nome`, `email`, `cargo`) ou o serviço em caso de rotinas automáticas (`system`)?
- [ ] **Alvos (`targets`)**: Há pelo menos um alvo identificando claramente o tipo, id e rótulo amigável da entidade impactada?
- [ ] **Rastreamento de Mudança (`diff`)**: Em operações de atualização (`updated`, `status_changed`), o objeto `diff` contendo `{ before, after }` foi fornecido?
- [ ] **Conformidade LGPD**: Garantiu que senhas brutas, tokens e dados bancários confidenciais não foram injetados em campos livres?
- [ ] **Não-Bloqueante**: A chamada utiliza `auditClient.log(...)` sem travar o tempo de resposta retornado ao usuário final?
- [ ] **Contexto de Rede**: O IP e o User-Agent foram capturados utilizando `getRequestContext(request)`?

