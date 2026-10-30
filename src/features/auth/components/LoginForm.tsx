"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { loginAction } from "@/features/auth/actions";
import { AuthFeedback } from "@/features/auth/components/AuthFeedback";
import { SubmitButton } from "@/features/auth/components/SubmitButton";
import { initialAuthActionState } from "@/features/auth/state";

export function LoginForm({ next = "/app/beranda" }: { next?: string }) {
  const action = loginAction.bind(null, next);
  const [state, formAction] = useActionState(action, initialAuthActionState);

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <AuthFeedback state={state} />
      <FormField
        autoComplete="email"
        error={state.fieldErrors?.email?.[0]}
        id="email"
        label="Email"
        name="email"
        placeholder="nama@contoh.id"
        required
        type="email"
      />
      <div className="grid gap-2">
        <FormField
          autoComplete="current-password"
          error={state.fieldErrors?.password?.[0]}
          id="password"
          label="Kata sandi"
          name="password"
          required
          type="password"
        />
        <Link
          className="justify-self-start text-sm font-semibold text-[var(--primary)] hover:underline"
          href="/lupa-password"
        >
          Lupa kata sandi?
        </Link>
      </div>
      <SubmitButton>Masuk</SubmitButton>
    </form>
  );
}
