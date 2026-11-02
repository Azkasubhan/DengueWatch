"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/integrations/supabase/server";
import { getSafeRedirect } from "@/lib/auth/safeRedirect";
import { appOrigin } from "@/lib/http/requestOrigin";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  updatePasswordSchema,
} from "@/lib/validation/auth";
import type { AuthActionState } from "@/features/auth/state";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function validationError(error: {
  flatten: () => { fieldErrors: Record<string, string[]> };
}) {
  return {
    status: "error" as const,
    message: "Periksa kembali data yang diisi.",
    fieldErrors: error.flatten().fieldErrors,
  };
}

function configurationError(): AuthActionState {
  return {
    status: "error",
    message: "Layanan akun belum dikonfigurasi. Hubungi pengelola aplikasi.",
  };
}

export async function loginAction(
  next: string,
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return configurationError();
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      status: "error",
      message: "Periksa kembali email dan kata sandi.",
    };
  }

  redirect(getSafeRedirect(next));
}

export async function registerAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    confirmPassword: formValue(formData, "confirmPassword"),
    displayName: formValue(formData, "displayName"),
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const origin = appOrigin();
  if (!origin) return configurationError();

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return configurationError();
  }

  const { displayName, email, password } = parsed.data;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/callback?next=/app/beranda`,
    },
  });

  if (error) {
    return {
      status: "error",
      message:
        "Pendaftaran belum berhasil. Periksa data atau coba kembali nanti.",
    };
  }

  if (data.session) {
    redirect("/app/beranda");
  }

  return {
    status: "success",
    message:
      "Pendaftaran diterima. Periksa email Anda untuk mengaktifkan akun sebelum masuk.",
  };
}

export async function forgotPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formValue(formData, "email"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const origin = appOrigin();
  if (!origin) return configurationError();

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return configurationError();
  }

  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${origin}/auth/callback?next=/atur-ulang-kata-sandi`,
    },
  );

  if (error) {
    return {
      status: "error",
      message:
        "Permintaan belum dapat diproses. Tunggu sebentar lalu coba kembali.",
    };
  }

  return {
    status: "success",
    message:
      "Jika email terdaftar, petunjuk pengaturan ulang kata sandi akan dikirim.",
  };
}

export async function updatePasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = updatePasswordSchema.safeParse({
    confirmPassword: formValue(formData, "confirmPassword"),
    password: formValue(formData, "password"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return configurationError();
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return {
      status: "error",
      message:
        "Tautan pemulihan tidak valid atau sudah kedaluwarsa. Minta tautan baru.",
    };
  }

  return {
    status: "success",
    message:
      "Kata sandi berhasil diperbarui. Anda dapat kembali menggunakan akun.",
  };
}

export async function logoutAction(returnTo: string) {
  const safeReturn = getSafeRedirect(returnTo, "/app/beranda");
  let failed = false;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    failed = Boolean(error);
  } catch {
    failed = true;
  }
  if (failed) {
    redirect(`${safeReturn}?logout=failed`);
  }
  redirect("/");
}
