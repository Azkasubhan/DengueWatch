"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { registerAction } from "@/features/auth/actions";
import { AuthFeedback } from "@/features/auth/components/AuthFeedback";
import { SubmitButton } from "@/features/auth/components/SubmitButton";
import { initialAuthActionState } from "@/features/auth/state";

export function RegisterForm() {
  const [state, formAction] = useActionState(
    registerAction,
    initialAuthActionState,
  );

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <AuthFeedback state={state} />
      <FormField
        autoComplete="nickname"
        error={state.fieldErrors?.displayName?.[0]}
        hint="Gunakan nama panggilan 2–100 karakter."
        id="displayName"
        label="Nama panggilan"
        maxLength={100}
        name="displayName"
        required
      />
      <FormField
        autoComplete="email"
        error={state.fieldErrors?.email?.[0]}
        id="email"
        label="Email"
        maxLength={254}
        name="email"
        placeholder="nama@contoh.id"
        required
        type="email"
      />
      <FormField
        autoComplete="new-password"
        error={state.fieldErrors?.password?.[0]}
        hint="Minimal 8 karakter."
        id="password"
        label="Kata sandi"
        maxLength={72}
        name="password"
        required
        type="password"
      />
      <FormField
        autoComplete="new-password"
        error={state.fieldErrors?.confirmPassword?.[0]}
        id="confirmPassword"
        label="Ulangi kata sandi"
        maxLength={72}
        name="confirmPassword"
        required
        type="password"
      />
      <p className="text-sm text-[var(--muted-foreground)]">
        Pendaftaran publik selalu membuat akun warga. Akses wilayah diberikan
        melalui proses persetujuan terpisah.
      </p>
      <SubmitButton>Daftar sebagai warga</SubmitButton>
    </form>
  );
}
