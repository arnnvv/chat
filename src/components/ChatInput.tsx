"use client";

import { sendMessageAction } from "@/actions";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/db/schema";
import {
  type ChangeEvent,
  type JSX,
  type KeyboardEvent,
  type Ref,
  type RefObject,
  useRef,
  useState,
} from "react";
import ReactTextareaAutosize from "react-textarea-autosize";
import { toast } from "sonner";

export const ChatInput = ({
  sender,
  receiver,
}: {
  sender: Omit<User, "password">;
  receiver: User;
}): JSX.Element => {
  const textareaRef: RefObject<HTMLAreaElement | null> =
    useRef<HTMLAreaElement | null>(null);

  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const sendMessage = async () => {
    try {
      if (!input) {
        toast.error("Can't send empty message");
        return;
      }
      setIsLoading(true);

      const res = await sendMessageAction({
        input,
        sender,
        receiver,
      });
      if (!res) throw new Error("Error While Sending Message");
      if ("message" in res) {
        toast.success(res.message, {
          id: "message-sent",
          action: {
            label: "Dismiss",
            onClick: (): string | number => toast.dismiss("message-sent"),
          },
        });
        setInput("");
        textareaRef.current?.focus();
      } else if ("error" in res) {
        toast.error(res.error, {
          id: "message-error",
          action: {
            label: "Dismiss",
            onClick: (): string | number => toast.dismiss("message-error"),
          },
        });
      }
    } catch (e) {
      toast.error(`Error While Sending Message: ${e}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border-t border-gray-200 px-4 pt-4 mb-2 sm:mb-0">
      <div className="relative flex-1 overflow-hidden rounded-lg shadow-sm ring-1 ring-inset ring-gray-300 focus-within:ring-2 focus-within:ring-cyan-400">
        <ReactTextareaAutosize
          ref={textareaRef as Ref<HTMLTextAreaElement>}
          onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          rows={1}
          value={input}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            setInput(e.target.value)
          }
          placeholder={`Message ${receiver.username}`}
          className="block w-full resize-none border-0 bg-transparent text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:py-1.5 sm:text-sm sm:leading-6"
        />

        <div
          onClick={(): void | undefined => textareaRef.current?.focus()}
          className="py-2"
          aria-hidden="true"
        >
          <div className="py-px">
            <div className="h-9" />
          </div>
        </div>

        <div className="absolute right-0 bottom-0 flex justify-between py-2 pl-3 pr-2">
          <div className="flex-shrin-0">
            <Button isLoading={isLoading} onClick={sendMessage} type="submit">
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
