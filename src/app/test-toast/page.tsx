"use client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Page(): JSX.Element {
  return (
    <Button
      variant="outline"
      onClick={(): string | number =>
        toast("Event has been created", {
          description: "MAA KI CHUT",
          action: {
            label: "Undo",
            onClick: () => console.log("Undo"),
          },
        })
      }
    >
      Show Toast
    </Button>
  );
}
