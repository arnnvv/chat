import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCurrentSession, signOutAction, uploadFile } from "@/actions";
import { LogOut, Upload } from "lucide-react";
import { Button } from "./ui/button";
import { SignOutFormComponent } from "./SignOutForm";
import { UploadFormComponent } from "./UploadFormComponent";
import { FileInput } from "./FileInput";
import type { JSX } from "react";

export const Navbar = async (): Promise<JSX.Element | null> => {
  const { user, session } = await getCurrentSession();

  if (session === null) return null;
  const text: string = !user.picture ? "Upload Image" : "Change Image";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
      <div className="pr-4 py-3 flex justify-end items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="cursor-pointer">
              <AvatarImage
                src={user?.picture || "/default-avatar.png"}
                alt={`${user?.username || "User"}'s avatar`}
              />
              <AvatarFallback>
                {user?.username ? user.username.charAt(0).toUpperCase() : "U"}
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
      </div>
    </nav>
  );
};
