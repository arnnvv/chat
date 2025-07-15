import type { Message } from "./db/schema";

type Email = {
  email: string;
};

export const validateEmail = (data: Email): boolean => {
  if (typeof data.email !== "string") {
    console.error("Invalid type: email must be a string.");
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    console.error("Invalid email format.");
    return false;
  }
  return true;
};

export const validateMessage = (data: Message): boolean => {
  if (typeof data.id !== "number") {
    console.error("Invalid type: id must be a number.");
    return false;
  }
  if (typeof data.senderId !== "number") {
    console.error("Invalid type: senderId must be a number.");
    return false;
  }
  if (typeof data.recipientId !== "number") {
    console.error("Invalid type: recipientId must be a number.");
    return false;
  }
  if (
    !(data.createdAt instanceof Date) ||
    Number.isNaN(data.createdAt.getTime())
  ) {
    console.error("Invalid type: createdAt must be a valid Date.");
    return false;
  }
  if (typeof data.content !== "string") {
    console.error("Invalid type: content must be a string.");
    return false;
  }
  return true;
};

export const validateMessages = (data: Message[]): boolean => {
  if (!Array.isArray(data)) {
    console.error("Invalid type: data must be an array.");
    return false;
  }
  for (const message of data) {
    if (!validateMessage(message)) {
      console.error("Invalid message in array.");
      return false;
    }
  }
  return true;
};
