import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { findings } from "@/features/landing/content";

export function FindingRows() {
  return (
    <section
      className="border-t border-[var(--border)] py-16 sm:py-28"
      id="temuan"
    >
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="reveal text-3xl font-bold tracking-[-0.03em] sm:text-5xl">
            Jenis temuan dan penanganannya
          </h2>
          <p className="reveal mt-4 text-[var(--muted-foreground)]">
            Arahkan kursor pada kartu untuk melihat penjelasan singkat tiap
            jenis temuan di lingkungan sekitar.
          </p>
        </div>

        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {findings.map((item, index) => (
            <li
              className="reveal group aspect-[4/5] [perspective:1200px]"
              key={item.category}
              tabIndex={0}
            >
              <div className="relative h-full w-full rounded-3xl transition-transform duration-700 ease-out [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] group-focus-visible:[transform:rotateY(180deg)]">
                {/* Sisi Depan: Foto & Judul Kategori */}
                <div className="absolute inset-0 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] [backface-visibility:hidden]">
                  <Image
                    alt={item.alt}
                    className="object-cover"
                    fill
                    placeholder="blur"
                    sizes="(min-width: 768px) 30vw, 100vw"
                    src={item.image}
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-2/5 bg-[linear-gradient(to_top,rgb(12_24_19/0.82)_0%,transparent_100%)]"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                    <h3 className="text-xl font-bold tracking-[-0.02em] sm:text-2xl">
                      {item.category}
                    </h3>
                  </div>
                </div>

                {/* Sisi Belakang (Flip): Deskripsi */}
                <div className="absolute inset-0 flex flex-col justify-between rounded-3xl bg-[var(--forest)] p-7 text-[var(--forest-foreground)] [backface-visibility:hidden] [transform:rotateY(180deg)] sm:p-8">
                  <span className="font-mono text-sm font-semibold text-[var(--mint)]">
                    0{index + 1}
                  </span>
                  <div>
                    <h3 className="text-2xl font-bold tracking-[-0.02em]">
                      {item.category}
                    </h3>
                    <p className="mt-3 text-base leading-relaxed text-[var(--forest-muted)]">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
