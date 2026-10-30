import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "@/components/forms/FormField";

describe("FormField", () => {
  it("associates its visible label, hint, and error with the input", () => {
    render(
      <FormField
        error="Email tidak valid."
        hint="Gunakan email aktif."
        id="email"
        label="Email"
        name="email"
        required
      />,
    );

    const input = screen.getByRole("textbox", { name: /email/i });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "Gunakan email aktif. Email tidak valid.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Email tidak valid.");
  });
});
