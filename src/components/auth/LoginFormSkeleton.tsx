import type { JSX } from "react";
import Skeleton from "react-loading-skeleton";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/seperator";
import "react-loading-skeleton/dist/skeleton.css";

export function LoginFormSkeleton(): JSX.Element {
  return (
    <Card className="w-full max-w-md bg-gray-100 border-none shadow-none animate-pulse">
      <CardHeader className="space-y-2 pb-6">
        <Skeleton height={36} width={100} className="mx-auto" />
        <Skeleton height={20} width={250} className="mx-auto" />
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton height={20} width={80} />
            <Skeleton height={40} />
          </div>
          <div className="space-y-2">
            <Skeleton height={20} width={80} />
            <Skeleton height={40} />
          </div>
        </div>
        <Skeleton height={40} className="mt-6" />
      </CardContent>
      <CardFooter className="flex flex-col items-center space-y-6">
        <Skeleton height={20} width={200} />
        <div className="w-full">
          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-gray-100 px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton height={40} />
            <Skeleton height={40} />
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
