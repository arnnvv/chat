import { LogOut, Upload } from "lucide-react";
import { getCurrentSession, signOutAction, uploadFile } from "@/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FileInput } from "./FileInput";
import { SignOutFormComponent } from "./SignOutForm";
import { UploadFormComponent } from "./UploadFormComponent";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export async function UserProfileDropdown() {
  const { user } = await getCurrentSession();
  if (!user) return null;

  const text: string = !user.picture ? "Upload Image" : "Change Image";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="cursor-pointer">
          <AvatarImage
            src={user.picture || "/default-avatar.png"}
            alt={`${user.username || "User"}'s avatar`}
          />
          <AvatarFallback>
            {user.username ? user.username.charAt(0).toUpperCase() : "U"}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <UploadFormComponent action={uploadFile}>
            <label
              htmlFor="upload-button"
              className="w-full block cursor-pointer hover:bg-secondary p-2 rounded-md transition-colors"
            >
              <div className="flex items-center">
                <Upload className="mr-2 h-4 w-4" />
                <span>{text}</span>
              </div>
              <FileInput />
            </label>
          </UploadFormComponent>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <SignOutFormComponent action={signOutAction}>
            <Button variant="ghost" className="w-full justify-start">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </Button>
          </SignOutFormComponent>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserProfileDropdownSkeleton() {
  return <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />;
}
