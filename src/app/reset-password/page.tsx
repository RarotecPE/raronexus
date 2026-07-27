import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Defina uma nova senha"
      description="Escolha sua senha para completar o cadastro ou restaurar o acesso a sua identidade RaroNexus."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
