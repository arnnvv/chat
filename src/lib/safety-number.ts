import { sha256 } from "./sha";
import { encodeHexLowerCase } from "./encoding";

export async function generateSafetyNumber(
  myPublicKeys: string[],
  theirPublicKeys: string[],
): Promise<string> {
  const sortedMyKeys = [...myPublicKeys].sort();
  const sortedTheirKeys = [...theirPublicKeys].sort();

  const combinedKeys = sortedMyKeys.join("") + sortedTheirKeys.join("");

  const hashBuffer = sha256(new TextEncoder().encode(combinedKeys));
  const hashHex = encodeHexLowerCase(hashBuffer);

  const numericString = hashHex.slice(0, 60);
  const grouped = numericString.match(/.{1,5}/g) || [];

  return grouped.join(" ");
}
