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
          nome: { type: "string" },
          email: { type: "string", format: "email" },
          ativo: { type: "boolean" },
          cadastro_status: { type: "string", enum: ["ativo", "inativo", "pendente"] },
        },
      },
    },
  },
  paths: {
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
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
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
        summary: "Criar usuario e enviar convite de cadastro",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["nome", "email", "cpf"],
                properties: {
                  nome: { type: "string" },
                  email: { type: "string", format: "email" },
                  cpf: { type: "string" },
                  telefone: { type: "string" },
                  avatar_url: { type: "string", format: "uri" },
                  ativo: { type: "boolean" },
                  is_admin: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Usuario criado" } },
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
        summary: "Desativar usuario",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Usuario desativado" } },
      },
    },
    "/users/{id}/invite": {
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
