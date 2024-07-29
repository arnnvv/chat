import { Icon } from "@/components/Icons";
import { LucideProps } from "lucide-react";
import { ForwardRefExoticComponent, RefAttributes } from "react";

interface User {
  name: string;
  email: string;
  image?: string;
  id: string;
}

interface Chat {
  id: string;
  messages: Message[];
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: number;
}

interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
}

interface IncommingFriendReq {
  senderId: string;
  senderEmail: string | null | undefined;
}

interface SidebarNavProps {
  id: number;
  name: string;
  href: string;
  icon: Icon;
}
