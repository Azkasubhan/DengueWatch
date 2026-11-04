import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { LinkButton } from "@/components/ui/LinkButton";
import kerjaBakti from "@/features/landing/images/kerja-bakti.webp";

export function CtaBanner() {
  return (
    <section className="relative isolate overflow-hidden">
      <Image
        alt=""
        className="-z-10 object-cover object-[50%_70%]"
        fill
        placeholder="blur"
        sizes="100vw"
        src={kerjaBakti}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(12_24_19/0.85)_0%,rgb(12_24_19/0.55)_60%,rgb(12_24_19/0.4)_100%)]"
      />
      <div className="mx-auto grid max-w-[var(--page-max)] gap-8 px-4 py-20 text-white sm:px-6 sm:py-28 lg:grid-cols-12 lg:items-end lg:px-8">
        <h2 className="text-4xl font-bold tracking-[-0.035em] text-balance sm:text-5xl lg:col-span-7">
          Mulai dari satu laporan di sekitar rumah Anda.
        </h2>
        <div className="lg:col-span-5">
          <p className="text-white/85">
            Daftar sebagai warga dalam satu menit. Pengelola dan kader di
            wilayah Anda akan menerima laporan dan menindaklanjutinya.
          </p>
          <LinkButton
            className="mt-6 min-h-12 border-white bg-white pr-2 pl-5 text-[var(--foreground)] hover:bg-[var(--sand)]"
            href="/daftar"
            variant="secondary"
          >
            Daftar sebagai warga
            <span className="grid size-8 place-items-center rounded-full bg-[var(--forest)] text-white">
              <ArrowRight aria-hidden="true" className="size-4" />
            </span>
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
