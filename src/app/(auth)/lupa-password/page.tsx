import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";

export const metadata: Metadata = { title: "Lupa kata sandi" };

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="mb-7">
        <h1 className="text-2xl font-bold tracking-[-0.025em]">
          Atur ulang kata sandi
        </h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          Masukkan email akun. Demi keamanan, respons tidak mengungkap apakah
          email terdaftar.
        </p>
      </div>
      <ForgotPasswordForm />
      <Link
        className="mt-6 block text-center text-sm font-semibold text-[var(--primary)] hover:underline"
        href="/login"
      >
        Kembali ke halaman masuk
      </Link>
    </>
  );
}
