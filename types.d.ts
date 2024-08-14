import { Message } from "@/lib/db/schema";

interface Chat {
  id: string;
  messages: Message[];
}
