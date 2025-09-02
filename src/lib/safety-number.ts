import { encodeHexLowerCase } from "./encoding";
import { sha256 } from "./sha";

export async function generateSafetyNumber(
  myPublicKeys: string[],
  theirPublicKeys: string[],
): Promise<string> {
  const allKeys = [...myPublicKeys, ...theirPublicKeys];
  const sortedAllKeys = allKeys.sort();

  const combinedKeys = sortedAllKeys.join("");
  const hashBuffer = sha256(new TextEncoder().encode(combinedKeys));
  const hashHex = encodeHexLowerCase(hashBuffer);

  const numericString = hashHex.slice(0, 60);
  const grouped = numericString.match(/.{1,5}/g) || [];

  return grouped.join(" ");
}
