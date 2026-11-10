import Image from "next/image";
import { LinkButton } from "@/components/ui/LinkButton";
import kerjaBakti from "@/features/landing/images/kerja-bakti.webp";

export function CtaBanner() {
  return (
    <section className="relative isolate overflow-hidden">
      <Image
        alt=""
        className="parallax-img -z-20 object-cover object-[50%_70%]"
        fill
        placeholder="blur"
        sizes="100vw"
        src={kerjaBakti}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[rgb(12_24_19/0.66)]"
      />
      <div className="mx-auto max-w-3xl px-4 py-24 text-center text-white sm:px-6 sm:py-32">
        <h2 className="reveal text-4xl font-bold tracking-[-0.035em] text-balance sm:text-5xl">
          Mulai dari satu laporan di sekitar rumah Anda.
        </h2>
        <p className="reveal mx-auto mt-4 max-w-xl text-white/90">
          Daftar sebagai warga dalam satu menit. Pengelola dan kader di wilayah
          Anda akan menerima laporan dan menindaklanjutinya.
        </p>
        <div className="reveal mt-8">
          <LinkButton
            className="min-h-12 border-white bg-white px-6 text-[var(--foreground)] hover:bg-[var(--sand)]"
            href="/daftar"
            variant="secondary"
          >
            Daftar sebagai warga
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
