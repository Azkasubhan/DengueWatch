import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { findings } from "@/features/landing/content";

export function FindingRows() {
  return (
    <section className="pb-16 sm:pb-24">
      <Container>
        <div className="rounded-[2rem] bg-[var(--sand)] px-5 py-12 sm:px-10 sm:py-16">
          <h2 className="text-center text-3xl font-bold tracking-[-0.03em] sm:text-5xl">
            Jenis temuan dan penanganannya
          </h2>
          <ul className="mt-10">
            {findings.map((item) => (
              <li
                className="grid gap-6 border-t border-[var(--border)] py-8 first:border-t-0 first:pt-0 md:grid-cols-12 md:items-center"
                key={item.category}
              >
                <div className="md:col-span-3">
                  <p className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
                    <MapPin aria-hidden="true" className="size-4" />
                    Sekitar rumah
                  </p>
                  <h3 className="mt-1 text-xl font-bold tracking-[-0.02em] text-[var(--primary)]">
                    {item.category}
                  </h3>
                  <Link
                    className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
                    href="/daftar"
                  >
                    Laporkan temuan
                    <span className="grid size-6 place-items-center rounded-full bg-[var(--forest)] text-white">
                      <ArrowRight aria-hidden="true" className="size-3.5" />
                    </span>
                  </Link>
                </div>
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl md:col-span-4">
                  <Image
                    alt={item.alt}
                    className="object-cover"
                    fill
                    placeholder="blur"
                    sizes="(min-width: 768px) 30vw, 100vw"
                    src={item.image}
                  />
                </div>
                <div className="md:col-span-5">
                  <p className="text-[var(--muted-foreground)]">
                    {item.description}
                  </p>
                  <dl className="mt-4 text-sm">
                    {[
                      ["Penanganan", item.handling],
                      ["Dikerjakan oleh", item.by],
                      ["Bukti selesai", item.proof],
                    ].map(([term, value]) => (
                      <div
                        className="flex justify-between gap-4 border-t border-[var(--border)] py-2.5"
                        key={term}
                      >
                        <dt className="text-[var(--muted-foreground)]">
                          {term}
                        </dt>
                        <dd className="text-right font-semibold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
