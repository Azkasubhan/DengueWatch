"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { updatePasswordAction } from "@/features/auth/actions";
import { AuthFeedback } from "@/features/auth/components/AuthFeedback";
import { SubmitButton } from "@/features/auth/components/SubmitButton";
import { initialAuthActionState } from "@/features/auth/state";

export function UpdatePasswordForm() {
  const [state, formAction] = useActionState(
    updatePasswordAction,
    initialAuthActionState,
  );

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <AuthFeedback state={state} />
      <FormField
        autoComplete="new-password"
        error={state.fieldErrors?.password?.[0]}
        hint="Minimal 8 karakter."
        id="password"
        label="Kata sandi baru"
        maxLength={72}
        name="password"
        required
        type="password"
      />
      <FormField
        autoComplete="new-password"
        error={state.fieldErrors?.confirmPassword?.[0]}
        id="confirmPassword"
        label="Ulangi kata sandi baru"
        maxLength={72}
        name="confirmPassword"
        required
        type="password"
      />
      <SubmitButton>Simpan kata sandi baru</SubmitButton>
      {state.status === "success" ? (
        <Link
          className="text-center text-sm font-semibold text-[var(--primary)]"
          href="/login"
        >
          Kembali ke halaman masuk
        </Link>
      ) : null}
    </form>
  );
}
