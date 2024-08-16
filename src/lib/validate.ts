import {
  SafeParseReturnType,
  ZodArray,
  ZodDate,
  ZodObject,
  ZodString,
  z,
} from "zod";
import { Message } from "./db/schema";

type MessageSchema = ZodObject<{
  id: ZodString;
  senderId: ZodString;
  recipientId: ZodString;
  createdAt: ZodDate;
  content: ZodString;
}>;

export const emailSchema: ZodObject<{
  email: ZodString;
}> = z.object({
  email: z
    .string({
      invalid_type_error: "invalid email",
    })
    .email(),
});

export const messageScheema: MessageSchema = z.object({
  id: z.string(),
  senderId: z.string(),
  recipientId: z.string(),
  createdAt: z.date(),
  content: z.string(),
});

export const messagesScheema: ZodArray<MessageSchema> = z.array(messageScheema);

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
