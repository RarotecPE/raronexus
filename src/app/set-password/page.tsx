import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function SetPasswordPage() {
  return (
    <AuthShell
      title="Definir senha"
      description="Escolha sua senha para completar o cadastro da sua identidade RaroNexus."
    >
      <ResetPasswordForm
        submitLabel="Definir senha"
        successMessage="Senha definida com sucesso."
      />
    </AuthShell>
  );
}
