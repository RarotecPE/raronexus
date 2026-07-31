import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function SetPasswordPage() {
  return (
    <AuthShell
      title="Completar cadastro"
      description="Informe seus dados de acesso e escolha sua senha para ativar sua identidade RaroNexus."
    >
      <ResetPasswordForm
        submitLabel="Definir senha"
        successMessage="Cadastro concluido com sucesso."
        completeRegistration
      />
    </AuthShell>
  );
}
