import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export const metadata: Metadata = { title: "Daftar" };

export default function RegisterPage() {
  return (
    <>
      <div className="mb-7">
        <h1 className="text-2xl font-bold tracking-[-0.025em]">
          Buat akun warga
        </h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          Daftar untuk mengikuti alur pencegahan di wilayah yang telah
          disetujui.
        </p>
      </div>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        Sudah memiliki akun?{" "}
        <Link
          className="font-semibold text-[var(--primary)] hover:underline"
          href="/login"
        >
          Masuk
        </Link>
      </p>
    </>
  );
}
