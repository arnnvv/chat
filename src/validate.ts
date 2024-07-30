import { z } from "zod";

export const emailSchema = z.string().email();
export type Email = z.infer<typeof emailSchema>;

export const validatedEmail = (email: Email): boolean =>
  emailSchema.safeParse(email).success;
