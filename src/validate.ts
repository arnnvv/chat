import { z, ZodArray, ZodNumber, ZodObject, ZodString } from "zod";

export const emailSchema = z.string().email();

export const messageScheema: ZodObject<{
  id: ZodString;
  senderId: ZodString;
  receiverId: ZodString;
  text: ZodString;
  timestamp: ZodNumber;
}> = z.object({
  id: z.string(),
  senderId: z.string(),
  receiverId: z.string(),
  text: z.string(),
  timestamp: z.number(),
});

export const messagesScheema: ZodArray<
  ZodObject<{
    id: ZodString;
    senderId: ZodString;
    receiverId: ZodString;
    text: ZodString;
    timestamp: ZodNumber;
  }>
> = z.array(messageScheema);

export type Email = z.infer<typeof emailSchema>;

export type Message = z.infer<typeof messageScheema>;

export type Messages = z.infer<typeof messagesScheema>;

export const validatedEmail = (email: Email): boolean =>
  emailSchema.safeParse(email).success;

export const validatedMessage = (message: Message): boolean =>
  messageScheema.safeParse(message).success;

export const validatedMessages = (messages: Messages): boolean =>
  messagesScheema.safeParse(messages).success;
