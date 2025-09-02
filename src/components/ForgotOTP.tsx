"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type JSX,
  type KeyboardEvent,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { resendOTPForgotPassword, verifyOTPForgotPassword } from "@/actions";

const OTP_LENGTH = 8;

export const ForgotOTP = ({
  userEmail,
}: {
  userEmail: string;
}): JSX.Element => {
  const [isPending, startTransition] = useTransition();
  const [isResendPending, startResendTransition] = useTransition();
  const router = useRouter();
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef<HTMLInputElement[]>([]);

  const handleInput = (e: FormEvent<HTMLInputElement>, index: number) => {
    const input = e.currentTarget;
    input.value = input.value.toUpperCase();

    if (input.value.length === 1 && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    } else if (input.value.length === 1 && index === OTP_LENGTH - 1) {
      input.form?.requestSubmit();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !e.currentTarget.value && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await verifyOTPForgotPassword(formData);
      if (result?.success) {
        toast.success(result.message);
        router.push(`/new-password/${userEmail}`);
      } else {
        toast.error(result?.message || "Invalid OTP");
      }
    });
  };

  const handleResendOTP = () => {
    if (resendCooldown > 0) return;

    startResendTransition(async () => {
      try {
        const result = await resendOTPForgotPassword(userEmail);
        if (result?.success) {
          toast.success(result.message);
          setResendCooldown(60);
          const cooldownTimer = setInterval(() => {
            setResendCooldown((prev) => {
              if (prev <= 1) {
                clearInterval(cooldownTimer);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else {
          toast.error(result?.message || "Resend failed");
        }
      } catch {
        toast.error("Failed to resend OTP. Please try again.");
      }
    });
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="userEmail" value={userEmail} />
        <div className="flex justify-center space-x-4">
          {Array.from({ length: OTP_LENGTH }, (_, index) => ({
            id: `forgot-otp-${index}`,
          })).map((item, index) => (
            <input
              key={item.id}
              type="text"
              pattern="[A-Za-z0-9]"
              maxLength={1}
              name={`otp[${index}]`}
              className="w-12 h-16 text-2xl text-center border-b-2 border-gray-300 bg-transparent text-gray-800 uppercase focus:outline-none focus:border-blue-500 transition-colors"
              required
              onInput={(e) => handleInput(e, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              ref={(el) => {
                if (el) inputRefs.current[index] = el;
              }}
            />
          ))}
        </div>
        <button type="submit" disabled={isPending} className="hidden" />
      </form>
      <div className="flex justify-between items-center mt-4 px-2">
        <button
          type="button"
          onClick={handleResendOTP}
          disabled={isResendPending || resendCooldown > 0}
          className="text-sm text-blue-600 hover:text-blue-800 transition-colors 
          disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          {resendCooldown > 0
            ? `Resend OTP in ${resendCooldown}s`
            : "Didn't Receive OTP?"}
        </button>
        <p className="text-gray-600 text-sm text-right">
          The OTP was sent to {userEmail}.
        </p>
      </div>
    </div>
  );
};
