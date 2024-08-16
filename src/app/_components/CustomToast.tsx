import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { chatHrefConstructor, cn } from "@/lib/utils";
import { toast } from "sonner";

export const CustomToast = ({
  t,
  senderId,
  sessionId,
  senderName,
  senderMessage,
}: {
  //@ts-ignore
  t;
  sessionId: string;
  senderId: string;
  senderName: string;
  senderMessage: string;
}): JSX.Element => (
  <div
    className={cn(
      "max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5",
      { "animate-enter": t.visible, "animate-leave": !t.visible },
    )}
  >
    <a
      onClick={(): string | number => toast.dismiss(t.id)}
      href={`/dashboard/chat/${chatHrefConstructor(sessionId, senderId)}`}
      className="flex-1 w-0 p-4"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 pt-0.5">
          <div className="relative h-10 w-10">
            <Avatar>
              <AvatarImage src="https://github.com/arnnvv.png" alt="@shadcn" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
          </div>
        </div>

        <div className="ml-3 flex-1">
          <p className="text-sm font-medium text-gray-900">{senderName}</p>
          <p className="mt-1 text-sm text-gray-500">{senderMessage}</p>
        </div>
      </div>
    </a>

    <div className="flex border-l border-gray-200">
      <button
        onClick={(): string | number => toast.dismiss(t.id)}
        className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-cyan-400 hover:text-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
      >
        Close
      </button>
    </div>
  </div>
);
