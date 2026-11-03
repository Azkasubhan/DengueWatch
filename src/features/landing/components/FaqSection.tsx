import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { contacts, faqs } from "@/features/landing/content";

// Decorative topographic lines behind the FAQ.
function ContourLines() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 -z-10 h-full w-full text-[var(--border)]"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 1200 800"
    >
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <path
          d={`M-50 ${120 + i * 90} C 200 ${40 + i * 90}, 380 ${260 + i * 90}, 620 ${150 + i * 90} S 1000 ${40 + i * 90}, 1250 ${170 + i * 90}`}
          key={i}
          stroke="currentColor"
          strokeWidth="1.25"
        />
      ))}
    </svg>
  );
}

export function FaqSection() {
  return (
    <section className="relative isolate py-16 sm:py-24" id="faq">
      <ContourLines />
      <Container size="form">
        <h2 className="text-center text-3xl font-bold tracking-[-0.03em] sm:text-5xl">
          Yang perlu Anda ketahui
        </h2>
        <div className="mt-10 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {faqs.map((item) => (
            <details className="group" key={item.question}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                {item.question}
                <Plus
                  aria-hidden="true"
                  className="size-5 shrink-0 transition-transform group-open:rotate-45"
                />
              </summary>
              <p className="pb-5 text-[var(--muted-foreground)]">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
        {contacts.some((contact) => contact.value) ? (
          <div className="mt-8 flex flex-col gap-4 rounded-3xl bg-[var(--surface)] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Masih punya pertanyaan?</p>
              <p className="text-sm text-[var(--muted-foreground)]">
                Hubungi kami melalui kontak di bagian bawah halaman.
              </p>
            </div>
            <Link
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
              href="#kontak"
            >
              Hubungi kami
              <span className="grid size-7 place-items-center rounded-full bg-[var(--forest)] text-white">
                <ArrowRight aria-hidden="true" className="size-4" />
              </span>
            </Link>
          </div>
        ) : null}
      </Container>
    </section>
  );
}
