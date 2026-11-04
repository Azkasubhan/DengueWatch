import Image from "next/image";
import { Brand } from "@/components/layout/Brand";
import { Container } from "@/components/layout/Container";
import kampung from "@/features/landing/images/kampung.webp";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative isolate flex min-h-screen flex-col justify-center py-8 sm:py-12">
      <Image
        alt=""
        className="-z-10 object-cover object-[50%_55%]"
        fill
        placeholder="blur"
        priority
        sizes="100vw"
        src={kampung}
      />
      {/* Dims the busy photo so the form card stays the focus. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgb(12_24_19/0.65)_0%,rgb(12_24_19/0.45)_45%,rgb(12_24_19/0.7)_100%)]"
      />
      <Container size="form">
        <div className="rounded-3xl border border-white/20 bg-[var(--surface)] p-6 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)] sm:p-8">
          <div className="mb-6 flex justify-center">
            <Brand />
          </div>
          {children}
        </div>
      </Container>
    </main>
  );
}
