import { hmacSHA256 } from "./primitives";

const MESSAGE_KEY_CONSTANT = new Uint8Array([0x01]);
const CHAIN_KEY_CONSTANT = new Uint8Array([0x02]);

export function advanceChainKey(chainKey: Uint8Array): {
  nextChainKey: Uint8Array;
  messageKey: Uint8Array;
} {
  const messageKey = hmacSHA256(chainKey, MESSAGE_KEY_CONSTANT);
  const nextChainKey = hmacSHA256(chainKey, CHAIN_KEY_CONSTANT);
  return { nextChainKey, messageKey };
}
