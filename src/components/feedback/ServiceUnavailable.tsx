import { Alert } from "@/components/feedback/Alert";

export function ServiceUnavailable() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Alert title="Layanan akun belum tersedia" variant="error">
        Konfigurasi Supabase belum tersedia atau data akun tidak dapat
        diverifikasi. Akses privat ditutup untuk mencegah kebocoran data.
      </Alert>
    </div>
  );
}
