import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { activities } from "@/features/landing/content";

export function Activities() {
  return (
    <section className="pb-16 sm:pb-24" id="pencegahan">
      <Container>
        <div className="grid gap-4 lg:grid-cols-12 lg:items-end">
          <h2 className="text-3xl font-bold tracking-[-0.03em] sm:text-5xl lg:col-span-7">
            Pencegahan dimulai dari kebiasaan.
          </h2>
          <p className="text-[var(--muted-foreground)] lg:col-span-5">
            Kegiatan rutin warga dan kader yang dicatat dan ditindaklanjuti
            melalui DengueWatch.
          </p>
        </div>
        <ul
          aria-label="Kegiatan pencegahan"
          tabIndex={0}
          className="-mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0"
        >
          {activities.map((item) => (
            <li
              className="w-[82%] shrink-0 snap-start overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] md:w-auto"
              key={item.title}
            >
              <div className="relative aspect-[4/3]">
                <Image
                  alt={item.alt}
                  className="object-cover"
                  fill
                  placeholder="blur"
                  sizes="(min-width: 768px) 30vw, 82vw"
                  src={item.image}
                />
                <span className="absolute top-4 left-4 rounded-full bg-[var(--forest)] px-3 py-1 text-xs font-semibold text-white">
                  {item.badge}
                </span>
              </div>
              <div className="p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-lg font-bold tracking-[-0.02em]">
                    {item.title}
                  </h3>
                  <span className="shrink-0 text-xs font-semibold text-[var(--clay)]">
                    {item.tag}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  {item.text}
                </p>
                <p className="mt-5 border-t border-[var(--border)] pt-4 text-sm">
                  <span className="block text-xs text-[var(--muted-foreground)]">
                    Jadwal
                  </span>
                  <span className="font-semibold">{item.when}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
