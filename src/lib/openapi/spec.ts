export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "RaroNexus API",
    version: "1.0.0",
    description: "API REST versionada para identidade corporativa e servicos compartilhados.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      ApiError: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string" },
          code: { type: "string" },
        },
      },
      UserResponseDTO: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          nome: { type: "string", nullable: true },
          email: { type: "string", format: "email" },
          ativo: { type: "boolean" },
          cadastro_status: { type: "string", enum: ["ativo", "inativo", "pendente"] },
        },
      },
      ApplicationResponseDTO: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          nome: { type: "string" },
          client_id: { type: "string" },
          logo_url: { type: "string", format: "uri", nullable: true },
          ativo: { type: "boolean" },
        },
      },
    },
  },
  paths: {
    "/email/send": {
      post: {
        summary: "Enviar e-mail padronizado por aplicacao",
        tags: ["Email"],
        servers: [{ url: "/api" }],
        parameters: [
          { name: "X-RaroNexus-Client-Id", in: "header", required: true, schema: { type: "string" } },
          { name: "X-RaroNexus-Client-Secret", in: "header", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["to", "subject", "title", "message"],
                properties: {
                  to: {
                    oneOf: [
                      { type: "string", format: "email" },
                      { type: "array", items: { type: "string", format: "email" } },
                    ],
                  },
                  subject: { type: "string" },
                  title: { type: "string" },
                  message: { type: "string", description: "Texto simples. HTML nao e aceito." },
                  action_label: { type: "string" },
                  action_url: { type: "string", format: "uri" },
                  metadata: { type: "object" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "E-mail enviado" },
          "401": { description: "Credenciais invalidas" },
          "403": { description: "Endpoint ou dominio nao liberado" },
        },
      },
    },
    "/email/test": {
      post: {
        summary: "Enviar e-mail de teste por aplicacao",
        tags: ["Email"],
        servers: [{ url: "/api" }],
        parameters: [
          { name: "X-RaroNexus-Client-Id", in: "header", required: true, schema: { type: "string" } },
          { name: "X-RaroNexus-Client-Secret", in: "header", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["to"],
                properties: {
                  to: { type: "string", format: "email" },
                  metadata: { type: "object" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Teste enviado" },
          "401": { description: "Credenciais invalidas" },
          "403": { description: "Endpoint ou dominio nao liberado" },
        },
      },
    },
    "/email/{endpoint}": {
      post: {
        summary: "Enviar e-mail por endpoint cadastrado",
        tags: ["Email"],
        servers: [{ url: "/api" }],
        parameters: [
          { name: "endpoint", in: "path", required: true, schema: { type: "string", pattern: "^[a-z0-9_.-]+$" } },
          { name: "X-RaroNexus-Client-Id", in: "header", required: true, schema: { type: "string" } },
          { name: "X-RaroNexus-Client-Secret", in: "header", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["to"],
                properties: {
                  to: {
                    oneOf: [
                      { type: "string", format: "email" },
                      { type: "array", items: { type: "string", format: "email" } },
                    ],
                  },
                  subject: { type: "string", description: "Obrigatorio se o endpoint nao tiver assunto padrao." },
                  title: { type: "string", description: "Obrigatorio se o endpoint nao tiver titulo padrao." },
                  message: { type: "string", description: "Texto simples. Obrigatorio se o endpoint nao tiver mensagem padrao." },
                  action_label: { type: "string" },
                  action_url: { type: "string", format: "uri" },
                  metadata: { type: "object" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "E-mail enviado" },
          "401": { description: "Credenciais invalidas" },
          "403": { description: "Endpoint ou dominio nao liberado" },
          "404": { description: "Endpoint inexistente ou inativo" },
          "422": { description: "Conteudo ausente ou invalido" },
        },
      },
    },
    "/auth/login": {
      post: {
        summary: "Realizar login",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["cpf", "password"],
                properties: {
                  cpf: { type: "string", example: "000.000.000-00" },
                  password: { type: "string", format: "password" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Sessao criada" },
          "401": { description: "Credenciais invalidas" },
        },
      },
    },
    "/auth/validate": {
      get: {
        summary: "Validar token JWT",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Token valido" },
          "401": { description: "Token invalido" },
        },
      },
    },
    "/auth/logout": {
      post: {
        summary: "Encerrar sessao global",
        tags: ["Auth"],
        responses: {
          "200": { description: "Sessao global revogada e cookie local limpo" },
        },
      },
    },
    "/sessions/introspect": {
      post: {
        summary: "Validar sessao global para uma aplicacao",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "client_id"],
                properties: {
                  token: { type: "string" },
                  client_id: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Sessao ativa com usuario e perfil da aplicacao" },
          "401": { description: "Sessao invalida ou encerrada" },
          "403": { description: "Acesso nao autorizado" },
        },
      },
    },
    "/sessions/revoke": {
      post: {
        summary: "Revogar sessao global",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token"],
                properties: { token: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "Sessao revogada" } },
      },
    },
    "/sso/token": {
      post: {
        summary: "Trocar authorization code por dados SSO",
        tags: ["SSO"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["grant_type", "client_id", "client_secret", "code", "redirect_uri"],
                properties: {
                  grant_type: { type: "string", enum: ["authorization_code"] },
                  client_id: { type: "string" },
                  client_secret: { type: "string" },
                  code: { type: "string" },
                  redirect_uri: { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Dados de usuario, aplicacao e perfil",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        token_type: { type: "string" },
                        expires_in: { type: "number" },
                        global_session_token: { type: "string" },
                        user: {
                          type: "object",
                          properties: {
                            id: { type: "string", format: "uuid" },
                            nome: { type: "string" },
                            email: { type: "string", format: "email" },
                            avatar_url: {
                              type: "string",
                              format: "uri",
                              nullable: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Codigo invalido ou expirado" },
          "401": { description: "Credenciais da aplicacao invalidas" },
          "403": { description: "Acesso nao autorizado" },
        },
      },
    },
    "/users/me": {
      get: {
        summary: "Consultar usuario autenticado",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Usuario autenticado" } },
      },
      put: {
        summary: "Atualizar perfil autenticado",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Perfil atualizado" } },
      },
    },
    "/users": {
      get: {
        summary: "Listar usuarios",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "search", in: "query", schema: { type: "string" } }],
        responses: { "200": { description: "Lista de usuarios" } },
      },
      post: {
        summary: "Convidar usuario por e-mail",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", format: "email" },
                  is_admin: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Convite criado e enviado" } },
      },
    },
    "/users/me/complete-registration": {
      put: {
        summary: "Completar cadastro do usuario autenticado",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["nome", "cpf"],
                properties: {
                  nome: { type: "string" },
                  cpf: { type: "string", example: "000.000.000-00" },
                  avatar_url: { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Cadastro concluido" },
          "409": { description: "CPF ja cadastrado" },
        },
      },
    },
    "/users/{id}": {
      get: {
        summary: "Consultar usuario por ID",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Usuario encontrado" } },
      },
      put: {
        summary: "Atualizar usuario",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Usuario atualizado" } },
      },
      delete: {
        summary: "Excluir usuario definitivamente",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Usuario excluido" } },
      },
    },
    "/user-invites": {
      get: {
        summary: "Listar convites pendentes",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "search", in: "query", schema: { type: "string" } }],
        responses: { "200": { description: "Lista de convites pendentes e expirados" } },
      },
    },
    "/user-invites/{id}": {
      post: {
        summary: "Reenviar convite de cadastro pendente",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Convite reenviado" },
          "409": { description: "Cadastro ja confirmado" },
        },
      },
      delete: {
        summary: "Cancelar convite pendente",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Convite cancelado" } },
      },
    },
    "/user-invites/{id}/resend": {
      post: {
        summary: "Reenviar convite pendente",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Convite reenviado" } },
      },
    },
    "/user-invites/validate": {
      get: {
        summary: "Validar token publico de convite",
        tags: ["Users"],
        parameters: [{ name: "token", in: "query", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Convite valido" } },
      },
    },
    "/user-invites/complete": {
      post: {
        summary: "Completar cadastro por convite",
        tags: ["Users"],
        responses: { "201": { description: "Usuario criado" } },
      },
    },
    "/user-invites/avatar": {
      post: {
        summary: "Enviar avatar usando token de convite",
        tags: ["Users"],
        responses: { "200": { description: "Avatar enviado" } },
      },
    },
    "/user-applications/{id}": {
      get: {
        summary: "Listar plataformas e perfis de um usuario",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Acessos do usuario" } },
      },
      put: {
        summary: "Atualizar perfis de um usuario nas plataformas",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Acessos atualizados" } },
      },
    },
    "/applications": {
      get: {
        summary: "Listar plataformas",
        tags: ["Applications"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Lista de plataformas" } },
      },
      post: {
        summary: "Cadastrar plataforma",
        tags: ["Applications"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["nome", "client_id", "redirect_uris"],
                properties: {
                  nome: { type: "string" },
                  descricao: { type: "string" },
                  client_id: { type: "string" },
                  logo_url: { type: "string", format: "uri" },
                  homepage_url: { type: "string", format: "uri" },
                  redirect_uris: { type: "array", items: { type: "string", format: "uri" } },
                  allowed_origins: { type: "array", items: { type: "string", format: "uri" } },
                  ativo: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Plataforma criada" } },
      },
    },
    "/applications/{applicationId}": {
      put: {
        summary: "Atualizar plataforma",
        tags: ["Applications"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "applicationId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Plataforma atualizada" } },
      },
    },
    "/applications/{applicationId}/assignments": {
      get: {
        summary: "Listar roles dos usuarios na plataforma",
        tags: ["Applications"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "applicationId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Lista de vinculos usuario-role" } },
      },
      put: {
        summary: "Atualizar roles dos usuarios na plataforma",
        tags: ["Applications"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "applicationId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Vinculos atualizados" } },
      },
    },
    "/applications/{applicationId}/access": {
      get: {
        summary: "Verificar acesso do usuario a aplicacao",
        tags: ["Applications"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "applicationId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Resultado de acesso" } },
      },
    },
  },
} as const;
