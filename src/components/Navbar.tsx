import type { JSX } from "react";
import { Suspense } from "react";
import {
  UserProfileDropdown,
  UserProfileDropdownSkeleton,
} from "./UserProfileDropdown";

export function Navbar(): JSX.Element | null {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
      <div className="pr-4 py-3 flex justify-end items-center">
        <Suspense fallback={<UserProfileDropdownSkeleton />}>
          <UserProfileDropdown />
        </Suspense>
      </div>
    </nav>
  );
}
