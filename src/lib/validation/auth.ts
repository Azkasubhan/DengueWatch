import { z } from "zod";

const emailSchema = z
  .email("Masukkan alamat email yang valid.")
  .max(254, "Alamat email terlalu panjang.")
  .transform((value) => value.toLowerCase());

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, "Kata sandi wajib diisi."),
  })
  .strict();

export const registerSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, "Nama panggilan minimal 2 karakter.")
      .max(100, "Nama panggilan maksimal 100 karakter."),
    email: emailSchema,
    password: z
      .string()
      .min(8, "Kata sandi minimal 8 karakter.")
      .max(72, "Kata sandi maksimal 72 karakter."),
    confirmPassword: z.string(),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi kata sandi tidak sama.",
  });

export const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Kata sandi minimal 8 karakter.")
      .max(72, "Kata sandi maksimal 72 karakter."),
    confirmPassword: z.string(),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi kata sandi tidak sama.",
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
