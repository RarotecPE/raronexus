import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Recuperacao de senha"
      description="Informe seu e-mail corporativo para receber o link seguro de redefinicao."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
