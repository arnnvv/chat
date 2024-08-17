import { NextRequest } from "next/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { FileUploadData } from "uploadthing/types";

const f = createUploadthing();

const auth = (req: Request): { id: string } => ({ id: "fakeId" });

export const ourFileRouter = {
  imageUploader: f({ image: { maxFileSize: "4MB" } })
    .middleware(
      async ({
        req,
      }: { req: NextRequest; res: undefined; event: undefined } & {
        files: readonly FileUploadData[];
        input: undefined;
      }): Promise<{ userId: string }> => {
        // This code runs on your server before upload
        const user = await auth(req);
        if (!user) throw new UploadThingError("Unauthorized");
        return { userId: user.id };
      },
    )
    .onUploadComplete(
      async ({ metadata, file }): Promise<{ uploadedBy: string }> => {
        // This code RUNS ON YOUR SERVER after upload
        console.log("Upload complete for userId:", metadata.userId);
        console.log("file url", file.url);
        // !!! Whatever is returned here is sent to the clientside `onClientUploadComplete` callback
        return { uploadedBy: metadata.userId };
      },
    ),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
