import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

export const chatHrefConstructor = (id1: number, id2: number): string => {
  const sortedIds: number[] = [id1, id2].sort();
  return `${sortedIds[0]}--${sortedIds[1]}`;
};

export const toPusherKey = (key: string): string => key.replace(/:/g, "__");
