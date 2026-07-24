export class ApiException extends Error {
  constructor(
    message: string,
    public readonly code = "API_ERROR",
    public readonly status = 400,
  ) {
    super(message);
  }
}

export function friendlyAuthError(message?: string) {
  if (!message) return "Nao foi possivel autenticar. Tente novamente.";
  if (message.toLowerCase().includes("invalid")) {
    return "E-mail ou senha invalidos.";
  }
  if (message.toLowerCase().includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }
  return message;
}
