import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthShell
      title="Acesse sua identidade corporativa"
      description="Entre uma vez e conecte-se aos sistemas internos autorizados pela empresa."
    >
      <LoginForm />
    </AuthShell>
  );
}
