import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Camera,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { LinkButton } from "@/components/ui/LinkButton";
import { Activities } from "@/features/landing/components/Activities";
import { CtaBanner } from "@/features/landing/components/CtaBanner";
import { FaqSection } from "@/features/landing/components/FaqSection";
import { FindingRows } from "@/features/landing/components/FindingRows";
import { ReportPreview } from "@/features/landing/components/ReportPreview";
import { TeamSection } from "@/features/landing/components/TeamSection";
import { reportCategoryLabels } from "@/features/reports/validation";
import cloggedDrain from "@/features/landing/images/clogged-drain.webp";
import discardedTire from "@/features/landing/images/discarded-tire.webp";
import halamanRumah from "@/features/landing/images/halaman-rumah.webp";
import kampung from "@/features/landing/images/kampung.webp";
import kerjaBakti from "@/features/landing/images/kerja-bakti.webp";
import memotretTemuan from "@/features/landing/images/memotret-temuan.webp";
import waterContainer from "@/features/landing/images/water-container.webp";

const steps = [
  {
    icon: Camera,
    title: "Temukan",
    text: "Foto, lokasi, dan catatan singkat. Saran AI membantu mengisi kategori, Anda yang memutuskan.",
  },
  {
    icon: ClipboardList,
    title: "Tindak",
    text: "Kader di wilayah Anda memverifikasi laporan dan membuat tugas dengan penanggung jawab yang jelas.",
  },
  {
    icon: CheckCircle2,
    title: "Tuntaskan",
    text: "Laporan selesai setelah bukti penanganan disetujui kader lain, bukan pelaksananya.",
  },
  {
    icon: BarChart3,
    title: "Pantau",
    text: "Pengelola melihat laporan yang menunggu, sedang ditangani, dan sudah selesai.",
  },
];

const roles = [
  {
    name: "Warga",
    does: "Memotret temuan, menambah keterangan bila kader meminta.",
    sees: "Status dan riwayat laporannya sendiri.",
  },
  {
    name: "Kader",
    does: "Memverifikasi laporan, membuat tugas, mengirim bukti, dan memeriksa bukti kader lain.",
    sees: "Laporan di wilayah tugasnya saja.",
  },
  {
    name: "Pengelola",
    does: "Memantau backlog dan penyelesaian. Tidak memverifikasi atau menugaskan.",
    sees: "Ringkasan, laporan, dan tugas di wilayah kelolanya, hanya untuk dibaca.",
  },
];

const boundaries = [
  "Tidak mendiagnosis penyakit atau memprediksi wabah.",
  "Tidak menyimpan data pasien.",
  "Saran AI hanya draf; keputusan tetap di tangan warga dan kader.",
  "Foto disimpan privat, dan metadata lokasinya dihapus otomatis.",
  "Akses data dibatasi sesuai peran dan wilayah tugas.",
];

function PhotoPill({ src }: { src: StaticImageData }) {
  return (
    <span className="relative mx-1 inline-block h-[0.85em] w-[1.9em] overflow-hidden rounded-full align-[-0.08em]">
      <Image alt="" className="object-cover" fill sizes="96px" src={src} />
    </span>
  );
}

function CornerArrow({ light = false }: { light?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-9 place-items-center rounded-full border ${light ? "border-white/40 text-white" : "border-[var(--border)]"}`}
    >
      <ArrowUpRight className="size-4" />
    </span>
  );
}

export default function HomePage() {
  return (
    <div className="landing flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <main className="flex-1">
        <section className="relative isolate flex min-h-[92svh] flex-col overflow-hidden text-white sm:min-h-svh lg:max-h-[60rem]">
          <Image
            alt="Gang permukiman yang rindang selepas hujan, dengan rumah beratap genteng, pagar hijau, dan deretan tanaman pot."
            className="-z-10 object-cover object-[50%_55%]"
            fill
            placeholder="blur"
            priority
            sizes="100vw"
            src={kampung}
          />
          {/* Keeps white text at AA contrast over the bright, busy photo. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgb(12_24_19/0.5)_0%,rgb(12_24_19/0.15)_22%,rgb(12_24_19/0.45)_50%,rgb(12_24_19/0.88)_100%)]"
          />
          <SiteHeader variant="overlay" />
          <div className="mx-auto mt-auto w-full max-w-[var(--page-max)] px-5 pb-10 sm:px-8 sm:pb-14 lg:px-12">
            <div className="mx-auto max-w-5xl text-center">
              <p className="text-sm font-semibold text-[var(--mint)]">
                Temukan. Tindak. Tuntaskan.
              </p>
              <h1 className="mt-4 text-[2.5rem] leading-[1.04] font-bold tracking-[-0.035em] text-balance sm:text-6xl lg:text-7xl">
                Genangan kecil di sekitar rumah, ditangani sampai tuntas.
              </h1>
            </div>
            <div className="mt-10 flex flex-col gap-6 sm:mt-14 lg:flex-row lg:items-end lg:justify-between">
              <p className="max-w-md text-base text-white/85 sm:text-lg">
                Laporkan tempat yang bisa menjadi sarang nyamuk. Kader RW
                memeriksa, menugaskan, dan memastikan penanganannya selesai.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <LinkButton className="min-h-12 pr-2 pl-5" href="/daftar">
                  Laporkan temuan
                  <span className="grid size-8 place-items-center rounded-full bg-white/20">
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </span>
                </LinkButton>
                <Link
                  className="inline-flex min-h-12 items-center rounded-full border border-white/50 px-5 text-sm font-semibold hover:bg-white/10"
                  href="/login"
                >
                  Masuk
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-24">
          <Container>
            <p className="mx-auto max-w-4xl text-center text-[1.6rem] leading-[1.35] font-semibold tracking-[-0.02em] text-balance sm:text-4xl">
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

            <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
              <article className="flex min-h-64 flex-col md:min-h-80 justify-between rounded-3xl bg-[var(--forest)] p-6 text-[var(--forest-foreground)]">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm text-[var(--forest-muted)]">
                    Warga · Kader · Pengelola
                  </p>
                  <CornerArrow light />
                </div>
                <div>
                  <h2 className="text-2xl leading-tight font-bold tracking-[-0.02em]">
                    Satu alur untuk satu RW.
                  </h2>
                  <p className="mt-3 text-[var(--forest-muted)]">
                    Semua pihak bekerja pada laporan yang sama, dengan status
                    yang bisa dilihat bersama.
                  </p>
                </div>
              </article>

              <article className="relative flex min-h-64 flex-col md:min-h-80 justify-between overflow-hidden rounded-3xl p-6 text-white">
                <Image
                  alt="Dua warga membersihkan saluran yang tersumbat daun dalam kerja bakti."
                  className="object-cover"
                  fill
                  placeholder="blur"
                  sizes="(min-width: 768px) 33vw, 100vw"
                  src={kerjaBakti}
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(12_24_19/0.1)_20%,rgb(12_24_19/0.9)_100%)]"
                />
                <div className="relative self-end">
                  <CornerArrow light />
                </div>
                <div className="relative">
                  <h2 className="text-2xl leading-tight font-bold tracking-[-0.02em]">
                    Setiap temuan punya penanggung jawab.
                  </h2>
                  <p className="mt-2 text-white/85">
                    Tugas dan bukti tercatat di satu tempat.
                  </p>
                </div>
              </article>

              <article className="flex min-h-64 flex-col md:min-h-80 justify-between rounded-3xl bg-[var(--sand)] p-6">
                <p className="text-sm font-semibold text-[var(--clay)]">
                  Aturan penyelesaian
                </p>
                <div>
                  <p className="text-6xl font-bold tracking-[-0.04em]">
                    2 kader
                  </p>
                  <p className="mt-3">
                    Setiap penyelesaian diperiksa oleh kader yang berbeda dari
                    pelaksananya.
                  </p>
                </div>
              </article>
            </div>
          </Container>
        </section>

        <section className="pb-16 sm:pb-24">
          <Container>
            <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-6">
                <h2 className="text-3xl font-bold tracking-[-0.03em] sm:text-5xl">
                  Dekat dengan keseharian warga.
                </h2>
                <p className="mt-4 max-w-xl text-[var(--muted-foreground)]">
                  Laporan dikelompokkan dalam kategori yang mudah dikenali,
                  sehingga kader bisa menilai dan menindaklanjuti dengan cepat.
                </p>
              </div>
              <ul
                aria-label="Kategori laporan"
                className="flex flex-wrap gap-2 lg:col-span-6 lg:justify-end"
              >
                {Object.entries(reportCategoryLabels)
                  .filter(([category]) => category !== "other")
                  .map(([, label]) => (
                    <li
                      className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium"
                      key={label}
                    >
                      {label}
                    </li>
                  ))}
              </ul>
            </div>
            <div className="relative mt-10">
              <div className="relative aspect-[4/5] overflow-hidden rounded-3xl sm:aspect-[16/9] lg:aspect-[2.2/1]">
                <Image
                  alt="Halaman bersama di antara rumah warga selepas hujan, dengan ember terbuka yang menampung air."
                  className="object-cover"
                  fill
                  placeholder="blur"
                  sizes="(min-width: 1440px) 1376px, 100vw"
                  src={halamanRumah}
                />
              </div>
              <div className="relative -mt-16 px-4 sm:-mt-24 sm:px-8 lg:absolute lg:right-8 lg:bottom-8 lg:mt-0 lg:px-0">
                <ReportPreview />
              </div>
            </div>
          </Container>
        </section>

        <section
          className="border-t border-[var(--border)] py-16 sm:py-24"
          id="cara-kerja"
        >
          <Container>
            <div className="grid gap-4 lg:grid-cols-12 lg:items-end">
              <h2 className="text-3xl font-bold tracking-[-0.03em] sm:text-5xl lg:col-span-7">
                Dari temuan sampai tuntas.
              </h2>
              <p className="text-[var(--muted-foreground)] lg:col-span-5">
                Empat tahap yang sama untuk setiap laporan, dengan riwayat yang
                tercatat dan tidak dapat diubah diam-diam.
              </p>
            </div>
            <div className="mt-10 grid gap-4 lg:grid-cols-12">
              <div className="relative aspect-[4/5] overflow-hidden rounded-3xl sm:aspect-[16/10] lg:col-span-5 lg:aspect-auto">
                <Image
                  alt="Tangan warga memotret ember berisi air hujan dengan ponsel."
                  className="object-cover"
                  fill
                  placeholder="blur"
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  src={memotretTemuan}
                />
              </div>
              <ol className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
                {steps.map(({ icon: Icon, title, text }) => (
                  <li
                    className="flex min-h-56 flex-col justify-between gap-8 rounded-3xl bg-[var(--surface)] p-6"
                    key={title}
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-11 place-items-center rounded-full bg-[var(--forest)] text-[var(--forest-foreground)]"
                    >
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <h3 className="text-xl font-bold tracking-[-0.02em]">
                        {title}
                      </h3>
                      <p className="mt-2 text-[var(--muted-foreground)]">
                        {text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Container>
        </section>

        <FindingRows />
        <Activities />
        <CtaBanner />

        <section
          className="border-t border-[var(--border)] py-16 sm:py-24"
          id="peran"
        >
          <Container className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
                Siapa melakukan apa
              </h2>
              <p className="mt-4 text-[var(--muted-foreground)]">
                Akun baru selalu berperan sebagai warga. Akses kader dan
                pengelola diberikan setelah penugasan wilayah yang sah.
              </p>
            </div>
            <dl className="lg:col-span-8">
              {roles.map((role) => (
                <div
                  className="grid gap-2 border-t border-[var(--border)] py-6 first:border-t-0 first:pt-0 sm:grid-cols-[8rem_1fr_1fr] sm:gap-6"
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

        <TeamSection />

        <section
          className="bg-[var(--forest)] py-16 text-[var(--forest-foreground)] sm:py-24"
          id="batasan"
        >
          <Container className="grid gap-10 lg:grid-cols-12">
            <h2 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl lg:col-span-4">
              Dirancang dengan batas yang jelas
            </h2>
            <ul className="grid gap-px overflow-hidden rounded-2xl bg-[rgb(255_255_255/0.12)] lg:col-span-8">
              {boundaries.map((item) => (
                <li
                  className="bg-[var(--forest)] px-1 py-4 sm:text-lg"
                  key={item}
                >
                  {item}
                </li>
              ))}
            </ul>
          </Container>
        </section>

        <FaqSection />
      </main>
      <SiteFooter />
    </div>
  );
}
