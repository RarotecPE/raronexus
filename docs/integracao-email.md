# Guia de Integração: API de E-mails do RaroNexus

Este guia foi elaborado para orientar **agentes de IA** e desenvolvedores de projetos satélites a realizarem integração com o serviço de envio de e-mails transacionais do **RaroNexus**.

---

## 1. Visão Geral

O RaroNexus centraliza o envio de e-mails de todo o ecossistema corporativo da Rarotec. Ao utilizar a API de e-mails do RaroNexus:
- A aplicação satélite **não precisa configurar credenciais SMTP** (como host, porta, senha do provedor de e-mail).
- O envio utiliza **templates corporativos padronizados** com a identidade visual da aplicação ou global (logotipo, cores, rodapé, e-mail de resposta `reply-to`).
- Todos os disparos são registrados em **logs centralizados de auditoria** com status de entrega, tempo, domínio dos destinatários e identificador do provedor de e-mail.
- O corpo do e-mail (`body`) enviado pela aplicação é renderizado com segurança dentro da tag `{{body}}` do template HTML pré-configurado no RaroNexus.

---

## 2. Variáveis de Ambiente

No projeto que consumirá o RaroNexus, declare as variáveis de ambiente a seguir:

### Arquivo `.env.example`
```env
# URL base do RaroNexus (sem barra no final)
# Em desenvolvimento local: http://localhost:3001
# Em produção: https://nexus.rarotec.com.br (ou a URL de produção da sua infraestrutura)
RARONEXUS_API_URL=http://localhost:3001

# Credenciais da Aplicação cadastradas no RaroNexus
RARONEXUS_CLIENT_ID=sua_aplicacao_client_id
RARONEXUS_CLIENT_SECRET=seu_super_secreto_client_secret
```

### Como obter as credenciais:
1. No painel administrativo do RaroNexus, a aplicação satélite deve estar registrada no catálogo de aplicações.
2. Cada aplicação possui um identificador único (`client_id`) e uma chave secreta (`client_secret`).
3. **Pré-requisitos obrigatórios no RaroNexus**:
   - A aplicação deve estar com status **ativo** (`ativo = true`).
   - O endpoint de e-mail desejado (ex: `send` ou endpoint personalizado) deve estar **ativo**.
   - No painel do RaroNexus, na aba de E-mails da aplicação, a permissão para o endpoint deve estar expressamente **habilitada**.

---

## 3. Autenticação e Cabeçalhos

A autenticação é realizada a nível de aplicação (Machine-to-Machine) por meio de cabeçalhos HTTP customizados.

### Cabeçalhos obrigatórios em todas as requisições:
| Cabeçalho | Tipo | Descrição |
| :--- | :--- | :--- |
| `Content-Type` | `string` | Deve ser fixo `application/json`. |
| `X-RaroNexus-Client-Id` | `string` | O `client_id` da sua aplicação registrado no RaroNexus. |
| `X-RaroNexus-Client-Secret` | `string` | O `client_secret` correspondente da aplicação. |

> **Atenção**: Nunca exponha o `X-RaroNexus-Client-Secret` no frontend (browser) do cliente. As chamadas devem ser realizadas **exclusivamente a partir do backend / servidor** da sua aplicação.

---

## 4. Endpoints Disponíveis

A API expõe dois tipos de endpoints para disparo:

### 4.1. Disparo Padrão (`POST /api/email/send`)
Utiliza o endpoint padrão do sistema identificado pela chave interna `send`.

- **Método**: `POST`
- **URL**: `{RARONEXUS_API_URL}/api/email/send`

### 4.2. Disparo por Endpoint Customizado (`POST /api/email/:endpoint`)
Permite utilizar templates, títulos e assuntos pré-configurados especificamente para fluxos temáticos (ex: `boas-vindas`, `alerta-seguranca`, `fatura-disponivel`, `redefinir-senha`).

- **Método**: `POST`
- **URL**: `{RARONEXUS_API_URL}/api/email/{endpoint}`
  - Exemplo: `{RARONEXUS_API_URL}/api/email/boas-vindas`
  - Requisito: O nome do endpoint deve conter apenas letras minúsculas, números, ponto, hífen ou underline (`^[a-z0-9_.-]+$`).

### 4.3. Teste de Conexão (`POST /api/email/test`)
Dispara um e-mail de teste rápido para validar se as credenciais e a liberação de envio estão ativas.

- **Método**: `POST`
- **URL**: `{RARONEXUS_API_URL}/api/email/test`
- **Payload**: `{ "to": "seu-email@rarotec.com.br" }`

---

## 5. Especificação do Payload (Request Body)

O corpo da requisição deve ser enviado no formato JSON de acordo com o esquema abaixo:

### Esquema do JSON
```json
{
  "to": "usuario@rarotec.com.br",
  "subject": "Confirmação de Operação",
  "body": "<h2>Olá, João!</h2><p>Sua operação foi concluída com sucesso.</p>",
  "attachments": [
    {
      "filename": "comprovante.pdf",
      "content_type": "application/pdf",
      "content_base64": "JVBERi0xLjQKJ..."
    }
  ],
  "metadata": {
    "origem": "modulo-financeiro",
    "transacao_id": "987456"
  }
}
```

### Detalhamento dos Campos:
| Campo | Tipo | Obrigatório? | Regras e Limites |
| :--- | :--- | :--- | :--- |
| `to` | `string` ou `string[]` | **Sim** | Pode ser uma string de e-mail único ou array com até **50 destinatários**. Todos devem ser e-mails válidos. |
| `subject` | `string` | Depende | Assunto da mensagem. **Obrigatório** se o endpoint não tiver um assunto padrão definido. Limite de **160 caracteres**. **Não aceita tags HTML**. |
| `body` | `string` | **Sim** | Conteúdo da mensagem (HTML ou texto simples). É inserido no placeholder `{{body}}` do template. Limite entre 1 e **20.000 caracteres**. |
| `attachments` | `array` de objetos | Não | Até **15 anexos**. Cada anexo deve conter `filename` (até 140 chars), `content_type` (até 100 chars) e `content_base64` (máx. 15 MB decodificado). |
| `metadata` | `object` | Não | Dicionário chave-valor JSON para auditoria e rastreamento nos logs do RaroNexus. |

---

## 6. Formato das Respostas

Todas as respostas da API do RaroNexus seguem um envelope padrão JSON.

### Resposta de Sucesso (`HTTP 200 OK`)
```json
{
  "success": true,
  "data": {
    "sent": true,
    "message_id": "<d3a4b9f0-1234-5678-abcd-ef0123456789@rarotec.com.br>"
  }
}
```

### Resposta de Falha (`HTTP 4xx / 5xx`)
```json
{
  "success": false,
  "message": "Endpoint de e-mail não liberado para esta aplicação.",
  "code": "EMAIL_ENDPOINT_NOT_ALLOWED"
}
```

### Tabela de Códigos de Erro Comuns:
| Código HTTP | `code` | Causa Provável | Solução |
| :--- | :--- | :--- | :--- |
| **400** | `VALIDATION_ERROR` | Payload fora dos padrões (ex: e-mail inválido, HTML no subject). | Verifique os campos e limites descritos na Seção 5. |
| **401** | `APPLICATION_CREDENTIALS_REQUIRED` | Headers `X-RaroNexus-Client-Id` ou `X-RaroNexus-Client-Secret` ausentes. | Envie ambos os headers na requisição. |
| **401** | `INVALID_APPLICATION_CREDENTIALS` | Credenciais incorretas ou a aplicação está desativada (`ativo = false`). | Verifique se o `client_id` e o `client_secret` estão corretos e se a aplicação está ativa. |
| **403** | `EMAIL_ENDPOINT_NOT_ALLOWED` | A aplicação não tem permissão para disparar através deste endpoint. | Solicite ao administrador do RaroNexus a habilitação do endpoint para a sua aplicação. |
| **404** | `EMAIL_ENDPOINT_NOT_FOUND` | O endpoint informado na URL não existe ou está inativo. | Cadastre ou ative o endpoint no RaroNexus. |
| **422** | `EMAIL_CONTENT_REQUIRED` | `subject` ou `body` ausentes, ou o template do endpoint não contém a tag `{{body}}`. | Envie `subject` e `body` e confira a configuração do template no Nexus. |
| **429** | `RATE_LIMITED` | Limite de envio por minuto excedido (limite padrão: **60 requisições/minuto**). | Aplique controle de concorrência ou fila (backoff exponencial). |

---

## 7. Exemplos de Código de Integração

### 7.1. TypeScript / Node.js (Recomendado para Projetos Next.js / Nest / Node)

Crie um arquivo de serviço no seu projeto, por exemplo em `src/lib/raro-email.ts`:

```typescript
export interface SendEmailOptions {
  to: string | string[];
  subject?: string;
  body: string;
  endpoint?: string; // Se omitido, envia para /api/email/send
  attachments?: Array<{
    filename: string;
    contentType: string;
    contentBase64: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface SendEmailResult {
  sent: boolean;
  messageId: string | null;
}

export async function sendRaroNexusEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const baseUrl = process.env.RARONEXUS_API_URL?.replace(/\/$/, "");
  const clientId = process.env.RARONEXUS_CLIENT_ID;
  const clientSecret = process.env.RARONEXUS_CLIENT_SECRET;

  if (!baseUrl || !clientId || !clientSecret) {
    throw new Error(
      "Configurações do RaroNexus ausentes. Defina RARONEXUS_API_URL, RARONEXUS_CLIENT_ID e RARONEXUS_CLIENT_SECRET."
    );
  }

  const endpointPath = options.endpoint
    ? `/api/email/${encodeURIComponent(options.endpoint)}`
    : "/api/email/send";

  const url = `${baseUrl}${endpointPath}`;

  const payload = {
    to: options.to,
    subject: options.subject,
    body: options.body,
    attachments: options.attachments?.map((att) => ({
      filename: att.filename,
      content_type: att.contentType,
      content_base64: att.contentBase64,
    })),
    metadata: options.metadata,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-RaroNexus-Client-Id": clientId,
      "X-RaroNexus-Client-Secret": clientSecret,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.success) {
    const errorCode = data?.code || "UNKNOWN_ERROR";
    const errorMessage = data?.message || `Falha na requisição HTTP: status ${response.status}`;
    throw new Error(`[RaroNexus Email Error] [${errorCode}] ${errorMessage}`);
  }

  return {
    sent: data.data.sent,
    messageId: data.data.message_id,
  };
}
```

#### Como utilizar no seu código:
```typescript
import { sendRaroNexusEmail } from "@/lib/raro-email";

// Exemplo 1: Envio simples
await sendRaroNexusEmail({
  to: "cliente@exemplo.com",
  subject: "Bem-vindo ao Portal",
  body: "<p>Seu acesso foi liberado com sucesso!</p>",
});

// Exemplo 2: Disparo através de endpoint temático com anexo
await sendRaroNexusEmail({
  endpoint: "fatura-mensal",
  to: ["financeiro@empresa.com", "diretoria@empresa.com"],
  subject: "Fatura de Outubro Disponível",
  body: "<p>Segue em anexo a fatura para conferência.</p>",
  attachments: [
    {
      filename: "fatura-outubro.pdf",
      contentType: "application/pdf",
      contentBase64: Buffer.from(pdfBuffer).toString("base64"),
    },
  ],
  metadata: {
    faturaId: 1042,
    competencia: "2026-10",
  },
});
```

---

### 7.2. Python (FastAPI / Django / Scripts)

```python
import os
import requests

def send_email(to, subject, body, endpoint=None, attachments=None, metadata=None):
    base_url = os.getenv("RARONEXUS_API_URL", "http://localhost:3001").rstrip("/")
    client_id = os.getenv("RARONEXUS_CLIENT_ID")
    client_secret = os.getenv("RARONEXUS_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise ValueError("Credenciais RARONEXUS_CLIENT_ID ou RARONEXUS_CLIENT_SECRET não definidas.")

    endpoint_path = f"/api/email/{endpoint}" if endpoint else "/api/email/send"
    url = f"{base_url}{endpoint_path}"

    headers = {
        "Content-Type": "application/json",
        "X-RaroNexus-Client-Id": client_id,
        "X-RaroNexus-Client-Secret": client_secret,
    }

    payload = {
        "to": to,
        "subject": subject,
        "body": body,
    }
    if attachments:
        payload["attachments"] = attachments
    if metadata:
        payload["metadata"] = metadata

    response = requests.post(url, json=payload, headers=headers, timeout=15)
    data = response.json()

    if not response.ok or not data.get("success"):
        code = data.get("code", "UNKNOWN_ERROR")
        message = data.get("message", response.text)
        raise RuntimeError(f"Erro ao disparar e-mail no RaroNexus [{code}]: {message}")

    return data["data"]
```

---

### 7.3. Exemplo via cURL

```bash
curl -X POST "http://localhost:3001/api/email/send" \
  -H "Content-Type: application/json" \
  -H "X-RaroNexus-Client-Id: sua_aplicacao_client_id" \
  -H "X-RaroNexus-Client-Secret: seu_super_secreto_client_secret" \
  -d '{
    "to": "destinatario@empresa.com",
    "subject": "Teste de Notificação",
    "body": "<p>Este é um teste de envio via RaroNexus API.</p>",
    "metadata": { "origem": "terminal-curl" }
  }'
```

---

## 8. Boas Práticas e Regras de Segurança

1. **Proteja as Credenciais**: Nunca commite o `.env` com as chaves reais nem as envie para o front-end web.
2. **Rate Limit**: O limite padrão é de 60 requisições por minuto por IP. Para disparos em massa, implemente filas assíncronas (ex: BullMQ, RabbitMQ, SQS) com controle de vazão (throttling).
3. **Não insira HTML no campo `subject`**: O campo `subject` é estritamente texto puro (máx. 160 caracteres). Se tags HTML forem detectadas nele, a requisição será rejeitada.
4. **Anexos em Base64**: Certifique-se de que cada arquivo anexo codificado tenha até 15 MB.
5. **Auditoria com `metadata`**: Sempre preencha o campo `metadata` com IDs de referência do seu sistema (ex: `user_id`, `ordem_id`), pois isso facilita a busca e diagnóstico nos logs do RaroNexus em caso de problemas de entrega.

