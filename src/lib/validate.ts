import {
  SafeParseReturnType,
  ZodArray,
  ZodDate,
  ZodObject,
  ZodString,
  z,
} from "zod";
import { Message } from "./db/schema";

export const emailSchema: ZodObject<{
  email: ZodString;
}> = z.object({
  email: z
    .string({
      invalid_type_error: "invalid email",
    })
    .email(),
});

export const messageScheema: ZodObject<{
  id: ZodString;
  senderId: ZodString;
  recipientId: ZodString;
  createdAt: ZodDate;
  content: ZodString;
}> = z.object({
  id: z.string(),
  senderId: z.string(),
  recipientId: z.string(),
  createdAt: z.date(),
  content: z.string(),
});

export const messagesScheema: ZodArray<
  ZodObject<{
    id: ZodString;
    senderId: ZodString;
    recipientId: ZodString;
    createdAt: ZodDate;
    content: ZodString;
  }>
> = z.array(messageScheema);

export type Email = z.infer<typeof emailSchema>;

export const validateEmail: (data: Email) => boolean = (
  data: Email,
): boolean => {
  const result: SafeParseReturnType<Email, Email> = emailSchema.safeParse(data);
  return result.success;
};

export const validateMessage: (data: Message) => boolean = (
  data: Message,
): boolean => {
  const result: SafeParseReturnType<Message, Message> =
    messageScheema.safeParse(data);
  return result.success;
};

export const validateMessages: (data: Message[]) => boolean = (
  data: Message[],
): boolean => {
  const result: SafeParseReturnType<Message[], Message[]> =
    messagesScheema.safeParse(data);
  return result.success;
};
