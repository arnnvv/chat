"use client";

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
import { getVerifiedDeviceIdsForContact, sendMessageAction } from "@/actions";
import { Button } from "@/components/ui/button";
import {
  deriveSharedSecret,
  encryptMessage,
  importPublicKey,
} from "@/lib/crypto";
import { cryptoStore } from "@/lib/crypto-store";
import type { User } from "@/lib/db/schema";
import type { UserWithDevices } from "@/lib/getFriends";

export const ChatInput = ({
  sender,
  receiver,
}: {
  sender: Omit<User, "password">;
  receiver: UserWithDevices;
}): JSX.Element => {
  const textareaRef: RefObject<HTMLTextAreaElement | null> =
    useRef<HTMLTextAreaElement | null>(null);

  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const sendMessage = async () => {
    if (!input.trim()) {
      toast.error("Cannot send an empty message.");
      return;
    }
    setIsLoading(true);

    try {
      const ownPrivateKey = await cryptoStore.getKey("privateKey");
      const senderDeviceId = await cryptoStore.getDeviceId();

      if (!ownPrivateKey || !senderDeviceId) {
        throw new Error(
          "Your encryption keys are not available on this device. Please log in again to set them up.",
        );
      }

      const verifiedDeviceIds = await getVerifiedDeviceIdsForContact(
        receiver.id,
      );
      const recipientDevicesToEncryptFor = receiver.devices.filter((device) =>
        verifiedDeviceIds.includes(device.id),
      );

      if (recipientDevicesToEncryptFor.length === 0) {
        throw new Error(
          `You haven't verified any of ${receiver.username}'s devices. Please verify their identity to send messages.`,
        );
      }

      const encryptedContent: Record<number, string> = {};

      for (const device of recipientDevicesToEncryptFor) {
        const recipientPublicKey = await importPublicKey(device.publicKey);
        const sharedKey = await deriveSharedSecret(
          ownPrivateKey,
          recipientPublicKey,
        );
        encryptedContent[device.id] = await encryptMessage(sharedKey, input);
      }

      const res = await sendMessageAction({
        senderDeviceId: parseInt(senderDeviceId, 10),
        encryptedContent,
        sender,
        receiver,
      });

      if (res?.error) {
        throw new Error(res.error);
      }

      setInput("");
      textareaRef.current?.focus();
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "An unknown error occurred.";
      toast.error(`Failed to send message: ${errorMessage}`, {
        id: "message-error",
      });
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
          onClick={(): void => textareaRef.current?.focus()}
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
