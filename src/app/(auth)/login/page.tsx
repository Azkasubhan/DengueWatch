import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { getSafeRedirect } from "@/lib/auth/safeRedirect";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = getSafeRedirect(
    typeof params.next === "string" ? params.next : undefined,
  );

  return (
    <>
      <div className="mb-7">
        <h1 className="text-2xl font-bold tracking-[-0.025em]">
          Masuk ke DengueWatch
        </h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          Gunakan akun yang sudah terdaftar untuk melanjutkan.
        </p>
      </div>
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        Belum memiliki akun?{" "}
        <Link
          className="font-semibold text-[var(--primary)] hover:underline"
          href="/daftar"
        >
          Daftar sebagai warga
        </Link>
      </p>
    </>
  );
}
