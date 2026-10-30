import { Brand } from "@/components/layout/Brand";
import { Container } from "@/components/layout/Container";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen py-8 sm:py-12">
      <Container size="form">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-8">
          {children}
        </div>
      </Container>
    </main>
  );
}
