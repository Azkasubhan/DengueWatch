import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/features/auth/components/UpdatePasswordForm";

export const metadata: Metadata = { title: "Kata sandi baru" };

export default function UpdatePasswordPage() {
  return (
    <>
      <div className="mb-7">
        <h1 className="text-2xl font-bold tracking-[-0.025em]">
          Buat kata sandi baru
        </h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          Tautan pemulihan harus dibuka pada peramban ini sebelum kata sandi
          dapat diganti.
        </p>
      </div>
      <UpdatePasswordForm />
    </>
  );
}
