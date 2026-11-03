import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { team } from "@/features/landing/content";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function TeamSection() {
  if (!team.length) return null;
  return (
    <section className="overflow-hidden py-16 sm:py-24" id="tim">
      <Container>
        <div className="text-center">
          <p className="text-sm font-semibold tracking-wide uppercase">
            Orang di balik DengueWatch
          </p>
          <h2 className="mt-1 text-6xl font-bold tracking-[-0.04em] text-transparent [-webkit-text-stroke:1.5px_var(--muted-foreground)] sm:text-8xl">
            Tim kami
          </h2>
        </div>
        <ul className="mx-auto mt-12 grid max-w-sm gap-4 sm:max-w-4xl sm:grid-cols-3 sm:items-start">
          {team.map((member, index) => (
            <li
              className={`relative aspect-[4/5] overflow-hidden rounded-3xl bg-[var(--forest)] ${index % 2 ? "" : "sm:mt-10"}`}
              key={`${member.name}-${index}`}
            >
              {member.photo ? (
                <Image
                  alt={`Foto ${member.name}`}
                  className="object-cover"
                  fill
                  placeholder="blur"
                  sizes="(min-width: 640px) 28vw, 90vw"
                  src={member.photo}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 grid place-items-center text-5xl font-bold text-[var(--forest-muted)]"
                >
                  {initials(member.name)}
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgb(12_24_19/0.85),transparent)] p-4 pt-12 text-white">
                <p className="font-semibold">{member.name}</p>
                <p className="text-sm text-white/80">{member.role}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
