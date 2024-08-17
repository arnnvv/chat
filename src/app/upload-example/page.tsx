"use client";

import { UploadButton } from "@/lib/uploadthing";
import { toast } from "sonner";
import { ClientUploadedFileData } from "uploadthing/types";

export default function Page(): JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <UploadButton
        endpoint="imageUploader"
        onClientUploadComplete={(
          res: ClientUploadedFileData<{ uploadedBy: string }>[],
        ) => {
          console.log("Files: ", res);
          toast.success("Upload Completed");
        }}
        onUploadError={(error: Error) => {
          toast.error(`ERROR! ${error.message}`);
        }}
      />
    </main>
  );
}
