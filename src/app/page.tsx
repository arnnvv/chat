"use client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Home(): JSX.Element {
  return (
    <Button
      onClick={() => {
        toast.success("click");
      }}
    >
      ARNAV
    </Button>
  );
}
