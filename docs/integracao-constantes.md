# Guia de Integração: API de Constantes do RaroNexus

Este guia orienta **agentes de IA** e desenvolvedores de projetos satélites a consumirem e gerenciarem constantes e tabelas de configuração mantidas centralmente pelo **RaroNexus**.

---

## 1. Visão Geral

As **Constantes do RaroNexus** funcionam como um repositório centralizado, versionado e seguro para armazenar estruturas JSON compartilhadas entre sistemas da empresa, tais como:
- Parâmetros globais do ecossistema e tabelas de configuração de regras de negócio.
- Dicionários, listas de domínios, mapeamentos de status, códigos de erro e tabelas de apoio.
- Modelos de dados e configurações de integrações que precisam ser atualizadas sem a necessidade de deploy dos sistemas consumidores.

### Características da Arquitetura:
1. **Versionamento Automático**: Toda alteração cria uma nova versão imutável. Versões antigas são mantidas para consulta por 15 dias antes da expiração.
2. **Alta Performance com ETag**: A API gera um hash SHA-256 (`ETag`) para o conteúdo. Requisições subsequentes com o cabeçalho `If-None-Match` respondem com `HTTP 304 Not Modified`, evitando tráfego de dados desnecessário.
3. **Dois Níveis de Visibilidade**:
   - **Públicas (`is_public = true`)**: Acesso livre sem autenticação, com CORS liberado (`*`) e cache agressivo.
   - **Privadas (`is_public = false`)**: Exigem autenticação por token de sessão corporativo (`global_session_token` do RaroNexus SSO) ou Cookie de sessão.

---

## 2. Variáveis de Ambiente

No projeto consumidor, declare as variáveis a seguir:

### Arquivo `.env.example`
```env
# URL base do RaroNexus (sem barra no final)
# Em desenvolvimento: http://localhost:3001
# Em produção: https://nexus.rarotec.com.br
RARONEXUS_API_URL=http://localhost:3001

# Token de Sessão Corporativo do RaroNexus
# Obrigatório APENAS para acessar constantes PRIVADAS no backend ou processos em lote
# (Para constantes públicas, nenhuma variável de token é necessária)
RARONEXUS_SESSION_TOKEN=seu_global_session_token_aqui

# Credenciais da Aplicação (necessárias se o seu backend obtiver o token via fluxo SSO)
RARONEXUS_CLIENT_ID=sua_aplicacao_client_id
RARONEXUS_CLIENT_SECRET=seu_super_secreto_client_secret
```

---

## 3. Padrão de Nomenclatura e Formato do Conteúdo

Ao buscar ou criar constantes, respeite as regras de validação do RaroNexus:
- **Nome da constante (`name`)**:
  - Pelo menos 2 e no máximo 80 caracteres.
  - Apenas letras minúsculas, números, ponto, hífen e underline (`^[a-z0-9][a-z0-9_.-]{1,79}$`).
  - Exemplos válidos: `tabela-precos-2026`, `config.app`, `status_pedidos_v1`.
  - Nomes reservados que **não** podem ser utilizados: `content` e `_content`.
- **Conteúdo da constante (`content`)**:
  - Deve ser uma string contendo um **JSON válido** (objeto `{}`, array `[]`, número, booleano, string entre aspas ou `null`).
  - Tamanho máximo: **10 MB** (em UTF-8).

---

## 4. Como Consumir Constantes (Leitura)

### 4.1. Endpoint de Resolução por Nome (`GET /api/constants/:name`)
É o ponto de entrada principal para ler uma constante.

- **Método**: `GET`
- **URL**: `{RARONEXUS_API_URL}/api/constants/{name}`
  - Exemplo: `http://localhost:3001/api/constants/tabela-precos`

### 4.2. Fluxo de Redirecionamento (HTTP 307)
A API do RaroNexus utiliza um padrão de redirecionamento imutável:
1. A requisição para `GET /api/constants/:name` verifica o nome e a versão ativa atual.
2. A API responde com **`HTTP 307 Temporary Redirect`**, apontando para a URL imutável versionada:
   ```http
   Location: /api/constants/content/{constantId}/{version}
   ```
3. O cliente HTTP segue o redirecionamento e baixa o JSON diretamente da rota de conteúdo.

> ⚠️ **ATENÇÃO CRÍTICA PARA AGENTES DE IA E CLIENTES HTTP**:
> - O cliente HTTP deve estar configurado para **seguir redirecionamentos** (no `fetch` nativo: `{ redirect: "follow" }`).
> - Em requisições para **constantes privadas**, certifique-se de que o cabeçalho `Authorization: Bearer <token>` seja **preservado durante o redirecionamento**.

---

## 5. Autenticação

### 5.1. Para Constantes Públicas (`is_public = true`)
- **Não requer nenhum token ou cabeçalho de autenticação**.
- Pode ser consumida diretamente tanto do backend quanto do frontend (browser).
- Headers retornados: `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=1296000, immutable`.

### 5.2. Para Constantes Privadas (`is_public = false`)
- **Cabeçalho obrigatório**:
  ```http
  Authorization: Bearer <RARONEXUS_SESSION_TOKEN>
  ```
- **Ou via Cookie**: `Cookie: raronexus_global_session=<RARONEXUS_SESSION_TOKEN>` (geralmente injetado automaticamente pelo navegador em sessões de SSO).

#### Como obter o `RARONEXUS_SESSION_TOKEN`:
O token de sessão é o `global_session_token` emitido pelo RaroNexus quando:
1. O usuário se autentica via fluxo de SSO (`POST /api/v1/sso/token`).
2. O usuário loga no painel do RaroNexus.
3. Se o seu serviço de backend precisa de acesso permanente a constantes privadas, configure uma sessão de serviço ou utilize as credenciais SSO para emitir um token válido.

---

## 6. Otimização com Cache e ETag

Cada versão de uma constante gera um hash criptográfico retornado no cabeçalho `ETag`.

### Cabeçalhos retornados pela rota de conteúdo:
| Cabeçalho | Exemplo | Descrição |
| :--- | :--- | :--- |
| `ETag` | `"d41d8cd98f00b204e9800998ecf8427e"` | Hash SHA-256 do conteúdo JSON da versão. |
| `X-Constant-Version` | `3` | Número da versão atual ativa. |
| `X-Constant-Hash` | `d41d8cd98f00b204e9800998ecf8427e` | Hash hexadecimal do conteúdo. |
| `X-Constant-Name` | `tabela-precos` | Nome da constante. |
| `Content-Type` | `application/json; charset=utf-8` | Tipo de conteúdo. |

### Como utilizar Revalidação Condicional (`If-None-Match`):
Quando sua aplicação já possui a constante em memória ou cache local:
1. Envie o cabeçalho `If-None-Match: "<hash_armazenado>"`.
2. Se a constante não mudou no RaroNexus:
   - A API responde com **`HTTP 304 Not Modified`** (sem corpo de resposta).
   - Sua aplicação continua usando o valor em cache, economizando tempo e banda.
3. Se a constante foi atualizada:
   - A API responde com **`HTTP 200 OK`** contendo o novo JSON e o novo `ETag`.

---

## 7. Rate Limits (Limites de Requisição)

O RaroNexus aplica limitação de taxa por janela de 1 minuto:

| Endpoint | Tipo | Limite por Minuto | Escopo de Rate Limit |
| :--- | :--- | :--- | :--- |
| `GET /api/constants/:name` | Pública | **300 req/min** | Por IP de origem |
| `GET /api/constants/:name` | Privada | **180 req/min** | Por Token/Identidade |
| `GET /api/constants/content/...` | Pública | **600 req/min** | Por IP de origem |
| `GET /api/constants/content/...` | Privada | **240 req/min** | Por Token/Identidade |

Se o limite for excedido, a API responderá com status **`HTTP 429 Too Many Requests`** e código `RATE_LIMITED`.

---

## 8. Exemplos Práticos de Código

### 8.1. TypeScript / Node.js (Cliente com Cache e ETag)

Crie `src/lib/raro-constants.ts` no seu projeto:

```typescript
interface CachedConstant<T> {
  data: T;
  etag: string;
  version: number;
  lastChecked: number;
}

const memoryCache = new Map<string, CachedConstant<unknown>>();

export interface FetchConstantOptions {
  name: string;
  isPrivate?: boolean;
  token?: string;
  /** Tempo mínimo em ms antes de revalidar com o servidor (ex: 60_000 = 1 min). Padrão: 30s */
  cacheTtlMs?: number;
}

export async function getRaroConstant<T = unknown>(options: FetchConstantOptions): Promise<T> {
  const { name, isPrivate = false, token, cacheTtlMs = 30_000 } = options;
  const baseUrl = process.env.RARONEXUS_API_URL?.replace(/\/$/, "");

  if (!baseUrl) {
    throw new Error("Variável RARONEXUS_API_URL não configurada.");
  }

  const cached = memoryCache.get(name) as CachedConstant<T> | undefined;
  const now = Date.now();

  // Se estiver dentro do tempo de TTL local, retorna o cache direto sem chamada de rede
  if (cached && now - cached.lastChecked < cacheTtlMs) {
    return cached.data;
  }

  const url = `${baseUrl}/api/constants/${encodeURIComponent(name)}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const authToken = token || (isPrivate ? process.env.RARONEXUS_SESSION_TOKEN : undefined);
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  } else if (isPrivate) {
    throw new Error(
      `A constante '${name}' é privada, mas nenhum token de autenticação foi fornecido.`
    );
  }

  if (cached?.etag) {
    headers["If-None-Match"] = cached.etag;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
    redirect: "follow", // Segue o redirect 307 automaticamente
  });

  // Se o servidor retornou 304, nosso cache continua 100% atualizado
  if (response.status === 304 && cached) {
    cached.lastChecked = now;
    return cached.data;
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const code = errorBody?.code || `HTTP_${response.status}`;
    const message = errorBody?.message || response.statusText;
    throw new Error(`[RaroNexus Constants Error] [${code}] ${message}`);
  }

  const newEtag = response.headers.get("ETag") || "";
  const version = Number(response.headers.get("X-Constant-Version") || "1");
  const data = (await response.json()) as T;

  memoryCache.set(name, {
    data,
    etag: newEtag,
    version,
    lastChecked: now,
  });

  return data;
}
```

#### Exemplo de uso:
```typescript
import { getRaroConstant } from "@/lib/raro-constants";

// Exemplo 1: Constante pública
interface TabelaPrecos {
  versao: string;
  itens: Array<{ sku: string; preco: number }>;
}

const precos = await getRaroConstant<TabelaPrecos>({
  name: "tabela-precos",
  isPrivate: false,
});
console.log("Preços carregados:", precos.itens.length);

// Exemplo 2: Constante privada
interface ConfigSeguranca {
  ipWhitelist: string[];
  maxTentativasLogin: number;
}

const config = await getRaroConstant<ConfigSeguranca>({
  name: "configuracoes-seguranca",
  isPrivate: true,
  // token é opcional se RARONEXUS_SESSION_TOKEN estiver no .env
});
console.log("IPs permitidos:", config.ipWhitelist);
```

---

### 8.2. Python (com `requests.Session`)

```python
import os
import requests

class RaroNexusConstantsClient:
    def __init__(self):
        self.base_url = os.getenv("RARONEXUS_API_URL", "http://localhost:3001").rstrip("/")
        self.session_token = os.getenv("RARONEXUS_SESSION_TOKEN")
        self.session = requests.Session()
        self.cache = {}

    def get_constant(self, name: str, is_private: bool = False):
        cached = self.cache.get(name)
        headers = {"Accept": "application/json"}

        if is_private:
            token = self.session_token
            if not token:
                raise ValueError(f"A constante '{name}' é privada, mas RARONEXUS_SESSION_TOKEN não foi configurado.")
            headers["Authorization"] = f"Bearer {token}"

        if cached and "etag" in cached:
            headers["If-None-Match"] = cached["etag"]

        url = f"{self.base_url}/api/constants/{name}"
        response = self.session.get(url, headers=headers, allow_redirects=True, timeout=10)

        if response.status_code == 304 and cached:
            return cached["data"]

        if not response.ok:
            try:
                err = response.json()
                msg = err.get("message", response.text)
                code = err.get("code", "ERROR")
            except Exception:
                msg, code = response.text, f"HTTP_{response.status_code}"
            raise RuntimeError(f"Erro ao buscar constante [{code}]: {msg}")

        data = response.json()
        etag = response.headers.get("ETag")
        if etag:
            self.cache[name] = {"data": data, "etag": etag}

        return data
```

---

### 8.3. Exemplo via cURL

#### Constante Pública:
```bash
# O parâmetro -L é obrigatório para seguir o redirecionamento 307
curl -L -X GET "http://localhost:3001/api/constants/tabela-precos" \
  -H "Accept: application/json"
```

#### Constante Privada:
```bash
curl -L -X GET "http://localhost:3001/api/constants/configuracoes-seguranca" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer seu_global_session_token_aqui"
```

#### Teste com ETag (Retorna 304 Not Modified):
```bash
curl -i -L -X GET "http://localhost:3001/api/constants/tabela-precos" \
  -H "Accept: application/json" \
  -H 'If-None-Match: "c055452f36d4df69924971c26b91122a20a4b7da3b27bcfb9c2fb910e5b7fb56"'
```

---

## 9. (Opcional) Gerenciamento Administrativo via API

Caso um agente ou serviço satélite precise **criar ou atualizar constantes programaticamente**, o RaroNexus disponibiliza endpoints administrativos em `/api/v1/constants`.

> **Requisito**: As rotas abaixo exigem autenticação de um usuário administrador (`is_admin = true`) via cabeçalho `Authorization: Bearer <supabase_admin_access_token>`.

### 9.1. Listar Constantes
- **Rota**: `GET /api/v1/constants`
- **Retorno**: Lista com metadados de todas as constantes cadastradas (sem o conteúdo pesado).

### 9.2. Criar Nova Constante
- **Rota**: `POST /api/v1/constants`
- **Body**:
  ```json
  {
    "name": "nova-constante-v1",
    "is_public": true,
    "content": "{\"status\": [\"pendente\", \"aprovado\", \"cancelado\"]}"
  }
  ```
- **Retorno**: `HTTP 201 Created` com o detalhe da constante e versão 1 criada.

### 9.3. Atualizar Constante (Controle Concorrente Otimista)
- **Rota**: `PUT /api/v1/constants/:id`
- **Body**:
  ```json
  {
    "name": "nova-constante-v1",
    "is_public": true,
    "content": "{\"status\": [\"pendente\", \"aprovado\", \"processando\", \"cancelado\"]}",
    "expected_version": 1,
    "expected_updated_at": "2026-10-08T19:00:00.000Z"
  }
  ```
- Se outro usuário tiver alterado a constante no intervalo, a API retorna `HTTP 409 Conflict` com código `CONSTANT_EDIT_CONFLICT`.

---

## 10. Tabela de Diagnóstico de Erros

| Código HTTP | `code` | Causa | Como Resolver |
| :--- | :--- | :--- | :--- |
| **400** | `INVALID_CONSTANT_NAME` | O nome informado na URL não obedece ao regex ou é reservado (`content`, `_content`). | Ajuste o nome para minúsculas sem espaços ou acentos. |
| **401** | `AUTH_REQUIRED` | Tentativa de acessar uma constante privada sem informar o token. | Envie o cabeçalho `Authorization: Bearer <token>`. |
| **401** | `GLOBAL_SESSION_INVALID` | O token de sessão informado não existe ou foi revogado. | Efetue novo login ou gere um novo token de sessão. |
| **401** | `GLOBAL_SESSION_EXPIRED` | O token de sessão expirou. | Reautentique o usuário ou serviço. |
| **404** | `CONSTANT_NOT_FOUND` | Não existe constante cadastrada com o nome informado. | Verifique a grafia do nome ou crie a constante no painel. |
| **404** | `CONSTANT_VERSION_NOT_FOUND` | A versão específica requisitada não existe. | Solicite a versão ativa atual. |
| **409** | `CONSTANT_NAME_CONFLICT` | Tentativa de cadastrar uma constante com nome já em uso. | Escolha outro nome para a constante. |
| **409** | `CONSTANT_EDIT_CONFLICT` | Conflito de versão na atualização concorrente. | Recarregue o registro atual antes de salvar. |
| **410** | `CONSTANT_VERSION_EXPIRED` | A versão histórica requisitada ultrapassou o período de retenção de 15 dias. | Utilize a versão atual ativa da constante. |
| **429** | `RATE_LIMITED` | Limite de requisições por minuto atingido. | Reduza a frequência e utilize o cache local com `If-None-Match`. |

