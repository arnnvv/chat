"use client";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  ComponentPropsWithoutRef,
  ElementRef,
  ForwardedRef,
  forwardRef,
  RefAttributes,
} from "react";
import { ClassProp } from "class-variance-authority/types";
import { LabelProps, Root } from "@radix-ui/react-label";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

const Label = forwardRef<
  ElementRef<typeof Root>,
  ComponentPropsWithoutRef<typeof Root> & VariantProps<typeof labelVariants>
>(
  (
    {
      className,
      ...props
    }: Omit<LabelProps & RefAttributes<HTMLLabelElement>, "ref"> &
      VariantProps<(props?: ClassProp | undefined) => string>,
    ref: ForwardedRef<HTMLLabelElement>,
  ): JSX.Element => (
    <Root ref={ref} className={cn(labelVariants(), className)} {...props} />
  ),
);
Label.displayName = Root.displayName;

export { Label };
