import { z } from "zod";

/** Shared field-level rules — used by both server actions and the REST API routes. */

export const studentInputSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required.").max(150, "Full name is too long."),
  email: z
    .union([z.string().trim().toLowerCase().email("Enter a valid email address."), z.literal("")])
    .optional()
    .nullable(),
  phone: z.string().trim().max(30, "Phone number is too long.").optional().nullable(),
  dob: z
    .string()
    .optional()
    .nullable()
    .refine((v) => {
      if (!v) return true;
      const d = new Date(v);
      return !isNaN(d.getTime()) && d <= new Date();
    }, "Date of birth cannot be in the future."),
});

export const mentorInputSchema = z.object({
  name: z.string().trim().min(1, "Full name is required.").max(150, "Full name is too long."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z.string().trim().max(30, "Phone number is too long.").optional().nullable(),
  yearsExperience: z.coerce.number().int().min(0).max(80).optional().nullable(),
});

export const institutionInputSchema = z.object({
  name: z.string().trim().min(1, "Institution name is required.").max(150, "Name is too long."),
  contactEmail: z
    .union([z.string().trim().toLowerCase().email("Enter a valid contact email address."), z.literal("")])
    .optional()
    .nullable(),
});

type SafeParseFailure = { success: false; error: z.ZodError };

/** First validation issue as a single user-facing string (matches the app's single-line error UI). */
export function zodFieldError(result: SafeParseFailure): string {
  return result.error.issues[0]?.message || "Invalid input.";
}
