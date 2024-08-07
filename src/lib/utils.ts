import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

export const chatHrefConstructor = (id1: string, id2: string): string => {
  const sortedIds = [id1, id2].sort();
  return `${sortedIds[0]}--${sortedIds[1]}`;
};
