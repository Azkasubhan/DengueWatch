"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { forgotPasswordAction } from "@/features/auth/actions";
import { AuthFeedback } from "@/features/auth/components/AuthFeedback";
import { SubmitButton } from "@/features/auth/components/SubmitButton";
import { initialAuthActionState } from "@/features/auth/state";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(
    forgotPasswordAction,
    initialAuthActionState,
  );

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <AuthFeedback state={state} />
      <FormField
        autoComplete="email"
        error={state.fieldErrors?.email?.[0]}
        id="email"
        label="Email akun"
        maxLength={254}
        name="email"
        required
        type="email"
      />
      <SubmitButton>Kirim petunjuk pemulihan</SubmitButton>
    </form>
  );
}
