import {
  SafeParseReturnType,
  ZodArray,
  ZodNumber,
  ZodObject,
  ZodString,
  z,
} from "zod";

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

export const validateMessages: (data: Messages) => boolean = (
  data: Messages,
): boolean => {
  const result: SafeParseReturnType<Messages, Messages> =
    messagesScheema.safeParse(data);
  return result.success;
};
