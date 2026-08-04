"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api/client-fetch";
import { AvatarCropper } from "@/components/ui/avatar-cropper";
import { uploadInviteAvatar } from "@/lib/avatar-upload";
import { formatCpf } from "@/lib/formatters";
import type { PublicInviteDTO, UserResponseDTO } from "@/lib/api/types";

const RECOVERY_FLOW_KEY = "raronexus-reset-password-flow";
const RECOVERY_FLOW_TYPES = new Set(["recovery"]);

type ResetPasswordFormProps = {
  submitLabel?: string;
  successMessage?: string;
  completeRegistration?: boolean;
};

function getCurrentFlowType() {
  if (typeof window === "undefined") return null;

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search);
  return hashParams.get("type") ?? searchParams.get("type");
}

export function ResetPasswordForm({
  submitLabel = "Atualizar senha",
  successMessage = "Senha atualizada com sucesso.",
  completeRegistration = false,
}: ResetPasswordFormProps) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [invite, setInvite] = useState<PublicInviteDTO | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingFlow, setCheckingFlow] = useState(completeRegistration);
  const [flowAllowed, setFlowAllowed] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const flowType = getCurrentFlowType();

    if (completeRegistration) {
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get("token") ?? "";

      if (!token) {
        queueMicrotask(() => {
          setFlowAllowed(false);
          setCheckingFlow(false);
          setMessage("Link invalido ou expirado. Acesse pelo e-mail de convite.");
        });
        return;
      }

      apiFetch<PublicInviteDTO>(`/api/v1/user-invites/validate?token=${encodeURIComponent(token)}`)
        .then((data) => {
          setInviteToken(token);
          setInvite(data);
          setFlowAllowed(true);
        })
        .catch((error) => {
          setFlowAllowed(false);
          setMessage(error instanceof Error ? error.message : "Link invalido ou expirado.");
        })
        .finally(() => setCheckingFlow(false));
      return;
    }

    if (flowType && RECOVERY_FLOW_TYPES.has(flowType)) {
      sessionStorage.setItem(RECOVERY_FLOW_KEY, "true");
    } else {
      sessionStorage.removeItem(RECOVERY_FLOW_KEY);
    }

    supabase.auth.getSession().then(({ data }) => {
      const hasRecoveryFlow = sessionStorage.getItem(RECOVERY_FLOW_KEY) === "true";
      const allowed = Boolean(data.session && hasRecoveryFlow);
      setFlowAllowed(allowed);
      setCheckingFlow(false);

      if (!allowed) {
        setMessage("Link invalido ou expirado. Solicite uma nova redefinicao de senha.");
      }
    });
  }, [completeRegistration]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!flowAllowed) {
      setMessage(
        completeRegistration
          ? "Link invalido ou expirado. Acesse pelo e-mail de convite."
          : "Link invalido ou expirado. Solicite uma nova redefinicao de senha.",
      );
      return;
    }

    if (password !== confirm) {
      setMessage("As senhas nao conferem.");
      return;
    }

    if (completeRegistration && (!nome.trim() || cpf.length !== 14)) {
      setMessage("Informe nome e CPF para concluir o cadastro.");
      return;
    }

    setLoading(true);

    if (completeRegistration) {
      try {
        const avatarUrl = avatarFile
          ? await uploadInviteAvatar(avatarFile, inviteToken)
          : null;

        await apiFetch<UserResponseDTO>("/api/v1/user-invites/complete", {
          method: "POST",
          body: JSON.stringify({
            token: inviteToken,
            nome: nome.trim(),
            cpf,
            password,
            ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
          }),
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Erro ao completar cadastro.");
        setLoading(false);
        return;
      }
    } else {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }
    }

    setMessage(successMessage);
    if (!completeRegistration) {
      sessionStorage.removeItem(RECOVERY_FLOW_KEY);
    }
    setLoading(false);
    router.replace("/login");
  }

  if (checkingFlow) {
    return (
      <p className="rounded-lg border border-cyan-400/30 bg-cyan-950/40 px-3 py-2 text-sm text-cyan-100">
        {completeRegistration ? "Validando link de cadastro..." : "Validando link de redefinicao..."}
      </p>
    );
  }

  if (!flowAllowed) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-rose-400/30 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
          {message || (
            completeRegistration
              ? "Link invalido ou expirado. Acesse pelo e-mail de convite."
              : "Link invalido ou expirado. Solicite uma nova redefinicao de senha."
          )}
        </p>
        <button className="btn-secondary w-full" type="button" onClick={() => router.replace("/login")}>
          Ir para login
        </button>
      </div>
    );
  }

  return (
    <>
      <form className="space-y-4" onSubmit={onSubmit}>
        {completeRegistration ? (
          <>
          {invite ? (
            <p className="rounded-lg border border-cyan-400/30 bg-cyan-950/40 px-3 py-2 text-sm text-cyan-100">
              Convite para {invite.email}
            </p>
          ) : null}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="nome">
              Nome *
            </label>
            <input
              id="nome"
              className="field"
              type="text"
              autoComplete="name"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              required
              minLength={2}
              maxLength={150}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="cpf">
              CPF *
            </label>
            <input
              id="cpf"
              className="field"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(event) => setCpf(formatCpf(event.target.value))}
              required
              maxLength={14}
            />
          </div>
        </>
        ) : null}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="password">
            Nova senha *
          </label>
          <input
            id="password"
            className="field"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="confirm">
            Confirmar nova senha *
          </label>
          <input
            id="confirm"
            className="field"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
            minLength={6}
          />
        </div>
        {completeRegistration ? (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="avatar">
              Foto de perfil
            </label>
            <input
              id="avatar"
              className="field"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.currentTarget.value = "";
                if (file) setAvatarCropFile(file);
              }}
            />
            {avatarFile ? (
              <span className="mt-2 flex items-center gap-2 text-xs font-normal text-cyan-200">
                <Upload size={14} aria-hidden="true" />
                {avatarFile.name} pronto para envio
              </span>
            ) : null}
          </div>
        ) : null}
        {message ? (
          <p className="rounded-lg border border-cyan-400/30 bg-cyan-950/40 px-3 py-2 text-sm text-cyan-100">
            {message}
          </p>
        ) : null}
        <button className="btn-primary w-full" disabled={loading} type="submit">
          <KeyRound size={17} aria-hidden="true" />
          {loading ? "Salvando..." : submitLabel}
        </button>
      </form>
      {avatarCropFile ? (
        <AvatarCropper
          file={avatarCropFile}
          onCancel={() => setAvatarCropFile(null)}
          onCrop={(file) => {
            setAvatarFile(file);
            setAvatarCropFile(null);
          }}
        />
      ) : null}
    </>
  );
}
