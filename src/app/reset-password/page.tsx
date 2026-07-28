import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Redefinir senha"
      description="Escolha uma nova senha para restaurar o acesso a sua identidade RaroNexus."
    >
      <ResetPasswordForm submitLabel="Redefinir senha" />
    </AuthShell>
  );
}
