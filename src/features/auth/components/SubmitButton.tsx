"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";

type SubmitButtonProps = {
  children: React.ReactNode;
};

export function SubmitButton({ children }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" isLoading={pending} type="submit">
      {children}
    </Button>
  );
}
