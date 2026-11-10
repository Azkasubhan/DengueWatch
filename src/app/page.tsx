import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Container } from "@/components/layout/Container";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { LinkButton } from "@/components/ui/LinkButton";
import { CtaBanner } from "@/features/landing/components/CtaBanner";
import { FindingRows } from "@/features/landing/components/FindingRows";
import cloggedDrain from "@/features/landing/images/clogged-drain.webp";
import discardedTire from "@/features/landing/images/discarded-tire.webp";
import halamanRumah from "@/features/landing/images/halaman-rumah.webp";
import kampung from "@/features/landing/images/kampung.webp";
import waterContainer from "@/features/landing/images/water-container.webp";

const steps = [
  {
    title: "Warga melapor",
    text: "Satu sampai tiga foto, lokasi opsional, dan catatan singkat. AI mengisi draf formulir dari foto; warga yang memeriksa dan mengirim.",
  },
  {
    title: "Pengelola memeriksa",
    text: "Pengelola wilayah memverifikasi laporan, meminta keterangan tambahan, atau menutupnya bila duplikat atau tidak sesuai.",
  },
  {
    title: "Pengelola menugaskan",
    text: "Laporan terverifikasi dijadikan tugas dengan tenggat, lalu diberikan kepada satu kader atau lebih di wilayahnya.",
  },
  {
    title: "Kader mengerjakan",
    text: "Setiap kader mengirim foto bukti penanganannya sendiri dari lokasi.",
  },
  {
    title: "Pengelola menyetujui",
    text: "Tugas selesai setelah bukti dari setiap kader disetujui. Bila belum tuntas, tugas dibuka kembali untuk putaran baru.",
  },
];

const roles = [
  {
    name: "Warga",
    does: "Memotret temuan dan menjawab bila pengelola meminta keterangan.",
    sees: "Status dan riwayat laporannya sendiri.",
  },
  {
    name: "Kader",
    does: "Mengerjakan tugas yang diberikan dan mengirim foto bukti miliknya.",
    sees: "Tugas yang ditugaskan kepadanya beserta laporan terkait.",
  },
  {
    name: "Pengelola",
    does: "Memverifikasi laporan, membuat tugas, menunjuk kader, dan menyetujui bukti.",
    sees: "Ringkasan, laporan, tugas, dan peta temuan di wilayah kelolanya.",
  },
];

function PhotoPill({ src }: { src: StaticImageData }) {
  return (
    <span className="relative mx-1 inline-block h-[0.85em] w-[1.9em] overflow-hidden rounded-full align-[-0.08em]">
      <Image alt="" className="object-cover" fill sizes="96px" src={src} />
    </span>
  );
}

function delay(ms: number): CSSProperties {
  return { "--d": `${ms}ms` } as CSSProperties;
}

export default function HomePage() {
  return (
    <div className="landing flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero 1 stays pinned; everything after it slides up and covers it. */}
        <section className="sticky top-0 isolate flex h-svh flex-col overflow-hidden text-white">
          <Image
            alt="Gang permukiman yang rindang selepas hujan, dengan rumah beratap genteng, pagar hijau, dan deretan tanaman pot."
            className="hero-zoom -z-20 object-cover object-[50%_55%]"
            fill
            placeholder="blur"
            priority
            sizes="100vw"
            src={kampung}
          />
          {/* One flat tint keeps white text at AA contrast; it deepens as the next layer arrives. */}
          <div
            aria-hidden="true"
            className="hero-dim absolute inset-0 -z-10 bg-[rgb(12_24_19)] opacity-55"
          />
          <div className="hero-exit mx-auto mt-auto w-full max-w-[var(--page-max)] px-5 pb-10 sm:px-8 sm:pb-14 lg:px-12">
            <div className="mx-auto max-w-5xl text-center">
              <p
                className="hero-rise text-sm font-semibold text-[var(--mint)]"
                style={delay(150)}
              >
                Temukan. Tindak. Tuntaskan.
              </p>
              <h1
                className="hero-rise mt-4 text-[2.5rem] leading-[1.04] font-bold tracking-[-0.035em] text-balance sm:text-6xl lg:text-7xl"
                style={delay(300)}
              >
                Genangan kecil di sekitar rumah, ditangani sampai tuntas.
              </h1>
            </div>
            <div
              className="hero-rise mt-10 flex flex-col gap-6 sm:mt-14 lg:flex-row lg:items-end lg:justify-between"
              style={delay(550)}
            >
              <p className="max-w-md text-base text-white/90 sm:text-lg">
                Laporkan tempat yang bisa menjadi sarang nyamuk. Pengelola
                wilayah memeriksa, menugaskan kader, dan memastikan
                penanganannya selesai.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <LinkButton className="min-h-12 px-6" href="/daftar">
                  Laporkan temuan
                </LinkButton>
                <Link
                  className="inline-flex min-h-12 items-center rounded-full border border-white/50 px-6 text-sm font-semibold transition-colors hover:bg-white/10"
                  href="/login"
                >
                  Masuk
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Everything below is one opaque layer that rides over the pinned hero. */}
        <div className="relative z-10 rounded-t-[2rem] bg-[var(--background)] shadow-[0_-30px_60px_-30px_rgb(0_0_0/0.45)] sm:rounded-t-[3rem]">
          {/* Hero 2 */}
          <section className="flex min-h-svh flex-col justify-center py-20 sm:py-28">
            <Container>
              <p className="reveal mx-auto max-w-4xl text-center text-[1.6rem] leading-[1.35] font-semibold tracking-[-0.02em] text-balance sm:text-4xl lg:text-5xl">
                Ember
                <PhotoPill src={waterContainer} />
                berisi air hujan, ban bekas
                <PhotoPill src={discardedTire} />
                di lahan kosong, saluran
                <PhotoPill src={cloggedDrain} />
                yang tersumbat daun.{" "}
                <span className="text-[var(--muted-foreground)]">
                  Temuan kecil seperti ini mudah terlewat, padahal di sanalah
                  nyamuk bisa berkembang biak.
                </span>
              </p>
              <div className="reveal relative mt-14 aspect-[4/5] overflow-hidden rounded-3xl sm:aspect-[16/9] lg:aspect-[2.4/1]">
                <Image
                  alt="Halaman bersama di antara rumah warga selepas hujan, dengan ember terbuka yang menampung air."
                  className="parallax-img object-cover"
                  fill
                  placeholder="blur"
                  sizes="(min-width: 1440px) 1376px, 100vw"
                  src={halamanRumah}
                />
              </div>
            </Container>
          </section>

          {/* Cara kerja (Judul di tengah, tanpa foto di kiri) */}
          <section
            className="border-t border-[var(--border)] py-16 sm:py-28"
            id="cara-kerja"
          >
            <Container>
              <div className="mx-auto max-w-3xl text-center">
                <h2 className="reveal text-3xl font-bold tracking-[-0.03em] sm:text-5xl">
                  Dari temuan sampai tuntas.
                </h2>
                <p className="reveal mx-auto mt-4 max-w-xl text-[var(--muted-foreground)]">
                  Lima langkah yang sama untuk setiap laporan, dengan riwayat
                  yang tercatat dan tidak dapat diubah diam-diam.
                </p>
              </div>
              <ol className="mx-auto mt-12 max-w-3xl border-t border-[var(--border)]">
                {steps.map((step, index) => (
                  <li
                    className="reveal grid grid-cols-[3.5rem_1fr] gap-4 border-b border-[var(--border)] py-7 sm:grid-cols-[5rem_1fr] sm:py-9"
                    key={step.title}
                  >
                    <span className="text-3xl font-bold tracking-[-0.03em] text-[var(--primary)] tabular-nums sm:text-4xl">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="text-xl font-bold tracking-[-0.02em] sm:text-2xl">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-[var(--muted-foreground)]">
                        {step.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Container>
          </section>

          <FindingRows />

          {/* Peran (Judul di tengah) */}
          <section
            className="border-t border-[var(--border)] py-16 sm:py-28"
            id="peran"
          >
            <Container>
              <div className="mx-auto max-w-3xl text-center">
                <h2 className="reveal text-3xl font-bold tracking-[-0.03em] sm:text-5xl">
                  Siapa melakukan apa
                </h2>
                <p className="reveal mx-auto mt-4 max-w-xl text-[var(--muted-foreground)]">
                  Akun baru selalu berperan sebagai warga. Akses kader dan
                  pengelola diberikan setelah penugasan wilayah yang sah.
                </p>
              </div>
              <dl className="mx-auto mt-12 max-w-3xl border-t border-[var(--border)]">
                {roles.map((role) => (
                  <div
                    className="reveal grid gap-2 border-b border-[var(--border)] py-6 sm:grid-cols-[8rem_1fr_1fr] sm:gap-6"
                    key={role.name}
                  >
                    <dt className="text-lg font-bold">{role.name}</dt>
                    <dd>
                      <span className="block text-xs font-semibold tracking-wide text-[var(--clay)] uppercase">
                        Melakukan
                      </span>
                      {role.does}
                    </dd>
                    <dd className="text-[var(--muted-foreground)]">
                      <span className="block text-xs font-semibold tracking-wide text-[var(--clay)] uppercase">
                        Melihat
                      </span>
                      {role.sees}
                    </dd>
                  </div>
                ))}
              </dl>
            </Container>
          </section>

          <CtaBanner />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
