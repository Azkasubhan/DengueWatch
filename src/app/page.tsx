import { ArrowRight, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { LinkButton } from "@/components/ui/LinkButton";

const steps = [
  {
    number: "01",
    title: "Temukan dan laporkan",
    description:
      "Warga mencatat temuan lingkungan secara ringkas dan transparan.",
  },
  {
    number: "02",
    title: "Periksa dan tindak lanjuti",
    description:
      "Kader berwenang memeriksa laporan hanya dalam wilayah tugasnya.",
  },
  {
    number: "03",
    title: "Pastikan penyelesaian",
    description:
      "Setiap tindakan memiliki status dan bukti yang dapat ditinjau kembali.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-[var(--border)] py-16 sm:py-24 lg:py-28">
          <Container>
            <div className="grid items-end gap-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
              <div className="max-w-3xl">
                <p className="mb-5 text-sm font-semibold text-[var(--primary)]">
                  Pencegahan dengue berbasis tindakan komunitas
                </p>
                <h1 className="text-[2.25rem] leading-[1.12] font-bold tracking-[-0.04em] sm:text-5xl lg:text-6xl">
                  Temuan lingkungan menjadi tindakan yang dapat ditelusuri.
                </h1>
                <p className="mt-6 max-w-2xl text-lg text-[var(--muted-foreground)]">
                  DengueWatch membantu warga, kader Jumantik, dan pengelola
                  komunitas mengoordinasikan pencegahan tanpa membuat klaim
                  diagnosis medis.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <LinkButton href="/daftar">
                    Daftar sebagai warga
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </LinkButton>
                  <LinkButton href="/login" variant="secondary">
                    Masuk ke akun
                  </LinkButton>
                </div>
              </div>
              <aside className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
                <ShieldCheck
                  aria-hidden="true"
                  className="size-7 text-[var(--primary)]"
                />
                <h2 className="mt-5 text-xl font-semibold">
                  Privasi dan kewenangan dibatasi
                </h2>
                <p className="mt-3 text-[var(--muted-foreground)]">
                  Akun baru selalu berperan sebagai warga. Akses wilayah, kader,
                  dan pengelola hanya tersedia setelah penugasan yang sah.
                </p>
              </aside>
            </div>
          </Container>
        </section>

        <section className="py-16 sm:py-20" id="cara-kerja">
          <Container>
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-[var(--primary)]">
                Cara kerja
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] sm:text-3xl">
                Alur yang jelas dari laporan hingga penyelesaian
              </h2>
            </div>
            <ol className="mt-10 grid gap-5 lg:grid-cols-3">
              {steps.map((step) => (
                <li
                  className="border-t-2 border-[var(--border)] pt-5"
                  key={step.number}
                >
                  <span className="font-mono text-sm font-semibold text-[var(--primary)]">
                    {step.number}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-[var(--muted-foreground)]">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        <section className="border-t border-[var(--border)] bg-[var(--surface)] py-12">
          <Container className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Data demonstrasi bersifat simulasi
              </h2>
              <p className="mt-1 text-[var(--muted-foreground)]">
                DengueWatch tidak memuat data pasien atau klaim afiliasi
                institusional.
              </p>
            </div>
            <LinkButton href="/daftar">Mulai dengan akun warga</LinkButton>
          </Container>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
