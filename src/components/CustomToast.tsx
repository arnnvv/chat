import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { chatHrefConstructor, cn } from "@/lib/utils";
import { JSX } from "react";
import { toast } from "sonner";

type ToastProps = {
  t: {
    id: string | number;
    visible: boolean;
  };
  sessionId: number;
  senderId: number;
  senderName: string;
  senderMessage: string;
  avatarUrl?: string;
};

const ToastContent = ({
  senderName,
  senderMessage,
  avatarUrl,
}: {
  senderName: string;
  senderMessage: string;
  avatarUrl?: string;
}): JSX.Element => (
  <div className="flex items-center space-x-3">
    <div className="flex-shrink-0">
      <Avatar className="h-10 w-10">
        <AvatarImage src={avatarUrl} alt={`Avatar of ${senderName}`} />
        <AvatarFallback>{senderName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
    </div>
    <div className="flex-grow min-w-0">
      <p className="text-sm font-medium text-gray-900 truncate">{senderName}</p>
      <p className="text-sm text-gray-500 truncate">{senderMessage}</p>
    </div>
  </div>
);

export const CustomToast = ({
  t,
  senderId,
  sessionId,
  senderName,
  senderMessage,
  avatarUrl = "https://github.com/arnnvv.png",
}: ToastProps): JSX.Element => (
  <div
    className={cn(
      "max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex items-center ring-1 ring-black ring-opacity-5 z-50",
      { "animate-enter": t.visible, "animate-leave": !t.visible },
    )}
  >
    <a
      onClick={(): string | number => toast.dismiss(t.id)}
      href={`/dashboard/chat/${chatHrefConstructor(sessionId, senderId)}`}
      className="flex-grow p-4"
    >
      <ToastContent
        senderName={senderName}
        senderMessage={senderMessage}
        avatarUrl={avatarUrl}
      />
    </a>
    <div className="flex-shrink-0 border-l border-gray-200">
      <button
        onClick={(): string | number => toast.dismiss(t.id)}
        className="h-full px-4 py-2 text-sm font-medium text-cyan-400 hover:text-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
      >
        Close
      </button>
    </div>
  </div>
);
