import { ZodError } from "zod";
import { ApiException } from "./errors";
import { fail } from "./response";

export async function handleApi(operation: () => Promise<Response>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiException) {
      return fail(error.message, error.code, error.status);
    }

    if (error instanceof ZodError) {
      return fail("Dados de entrada invalidos.", "VALIDATION_ERROR", 422);
    }

    console.error(error);
    return fail("Erro interno do servidor.", "INTERNAL_SERVER_ERROR", 500);
  }
}
