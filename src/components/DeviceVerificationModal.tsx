"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { verifyDevicesAction } from "@/actions";
import type { UserWithDevices } from "@/lib/getFriends";
import { generateSafetyNumber } from "@/lib/safety-number";
import { Button } from "./ui/button";

interface DeviceVerificationModalProps {
  sessionUser: UserWithDevices;
  chatPartner: UserWithDevices;
  unverifiedDevices: UserWithDevices["devices"];
  onVerificationComplete: () => void;
}

export function DeviceVerificationModal({
  sessionUser,
  chatPartner,
  unverifiedDevices,
  onVerificationComplete,
}: DeviceVerificationModalProps) {
  const [safetyNumber, setSafetyNumber] = useState("Generating...");
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function calculateSafetyNumber() {
      const myKeys = sessionUser.devices.map((d) => d.publicKey);
      const theirKeys = chatPartner.devices.map((d) => d.publicKey);

      const num = await generateSafetyNumber(myKeys, theirKeys);
      setSafetyNumber(num);
    }
    calculateSafetyNumber();
  }, [sessionUser, chatPartner]);

  const handleCheckboxChange = (deviceId: number, checked: boolean) => {
    setSelectedDeviceIds((prev) =>
      checked ? [...prev, deviceId] : prev.filter((id) => id !== deviceId),
    );
  };

  const handleVerify = () => {
    if (selectedDeviceIds.length === 0) {
      toast.info("Please select at least one device to verify.");
      return;
    }
    startTransition(async () => {
      const result = await verifyDevicesAction(selectedDeviceIds);
      if (result.success) {
        toast.success("Devices verified!");
        onVerificationComplete();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="text-blue-500" /> Verify Safety Number
        </h2>
        <p className="text-gray-600 mt-2">
          To ensure your conversation is secure, compare this safety number with{" "}
          <span className="font-semibold">{chatPartner.username}</span>. If it
          matches, your communication is end-to-end encrypted.
        </p>
        <div className="my-6 p-4 bg-gray-100 rounded-md text-center">
          <p className="text-sm text-gray-500 mb-2">Your Safety Number</p>
          <div className="text-xl font-mono tracking-wider break-all">
            {safetyNumber}
          </div>
        </div>

        <h3 className="font-semibold">Unverified Devices:</h3>
        <p className="text-sm text-gray-500 mb-2">
          If the number above matches, tick the new device(s) below to trust
          them.
        </p>
        <div className="space-y-2">
          {unverifiedDevices.map((device) => (
            <label
              key={device.id}
              className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-50"
            >
              <input
                type="checkbox"
                onChange={(e) =>
                  handleCheckboxChange(device.id, e.target.checked)
                }
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Device ending in ...{device.publicKey.slice(-8)}</span>
            </label>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onVerificationComplete}>
            Cancel
          </Button>
          <Button
            onClick={handleVerify}
            disabled={isPending || selectedDeviceIds.length === 0}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Trust Selected Devices
          </Button>
        </div>
      </div>
    </div>
  );
}
