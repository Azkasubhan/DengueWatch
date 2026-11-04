import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import waterContainer from "@/features/landing/images/water-container.webp";

// A static example of the report timeline used in the app; names and times are illustrative.
const timeline = [
  { time: "Sen 07.40", text: "Dilaporkan warga dengan satu foto" },
  {
    time: "Sen 10.15",
    text: "Diverifikasi pengelola, ditugaskan ke kader Rina",
  },
  { time: "Sel 16.30", text: "Rina mengirim bukti: ember dikuras dan ditutup" },
  { time: "Rab 08.05", text: "Bukti disetujui pengelola" },
];

export function ReportPreview() {
  return (
    <article
      aria-labelledby="report-preview-title"
      className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_1px_2px_rgb(23_37_31/0.06),0_16px_40px_-16px_rgb(23_37_31/0.25)]"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
          Contoh laporan
        </p>
        <span className="rounded-full bg-[var(--primary-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--primary)]">
          Selesai
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="relative size-12 shrink-0 overflow-hidden rounded-lg">
          <Image
            alt=""
            className="object-cover"
            fill
            sizes="48px"
            src={waterContainer}
          />
        </div>
        <div>
          <h2
            id="report-preview-title"
            className="text-base leading-snug font-semibold"
          >
            Ember berisi air hujan di halaman belakang
          </h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            RT 03 · RW 05
          </p>
        </div>
      </div>
      <ol className="mt-4 grid gap-3 border-l border-[var(--border)] pl-4">
        {timeline.map((item, index) => {
          const last = index === timeline.length - 1;
          return (
            <li className="relative grid gap-0.5" key={item.time}>
              <span
                aria-hidden="true"
                className={`absolute top-1.5 -left-[1.3rem] size-2 rounded-full ${last ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
              />
              <span className="text-xs text-[var(--muted-foreground)] tabular-nums">
                {item.time}
              </span>
              <span
                className={`text-sm ${last ? "font-semibold" : ""} inline-flex items-center gap-1.5`}
              >
                {item.text}
                {last ? (
                  <CheckCircle2
                    aria-hidden="true"
                    className="size-4 text-[var(--primary)]"
                  />
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
