"use client";
import {
  type AvatarFallbackProps,
  type AvatarImageProps,
  type AvatarProps,
  Fallback,
  Image,
  Root,
} from "@radix-ui/react-avatar";
import {
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type ForwardedRef,
  forwardRef,
  type JSX,
  type RefAttributes,
} from "react";
import { cn } from "@/lib/utils";

export const Avatar = forwardRef<
  ComponentRef<typeof Root>,
  ComponentPropsWithoutRef<typeof Root>
>(
  (
    {
      className,
      ...props
    }: Omit<AvatarProps & RefAttributes<HTMLSpanElement>, "ref">,
    ref: ForwardedRef<HTMLSpanElement>,
  ): JSX.Element => (
    <Root
      ref={ref}
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        className,
      )}
      {...props}
    />
  ),
);
Avatar.displayName = Root.displayName;

export const AvatarImage = forwardRef<
  ComponentRef<typeof Image>,
  ComponentPropsWithoutRef<typeof Image>
>(
  (
    {
      className,
      ...props
    }: Omit<AvatarImageProps & RefAttributes<HTMLImageElement>, "ref">,
    ref: ForwardedRef<HTMLImageElement>,
  ): JSX.Element => (
    <Image
      ref={ref}
      alt=""
      className={cn("aspect-square h-full w-full", className)}
      {...props}
    />
  ),
);
AvatarImage.displayName = Image.displayName;

export const AvatarFallback = forwardRef<
  ComponentRef<typeof Fallback>,
  ComponentPropsWithoutRef<typeof Fallback>
>(
  (
    {
      className,
      ...props
    }: Omit<AvatarFallbackProps & RefAttributes<HTMLSpanElement>, "ref">,
    ref: ForwardedRef<HTMLSpanElement>,
  ): JSX.Element => (
    <Fallback
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-muted",
        className,
      )}
      {...props}
    />
  ),
);
AvatarFallback.displayName = Fallback.displayName;
