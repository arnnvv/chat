import type { Device, User } from "./db/schema";

export type SafeUser = Pick<
  User,
  "id" | "username" | "email" | "verified" | "picture"
>;

export type PublicDeviceInfo = Pick<
  Device,
  "id" | "userId" | "publicKey" | "identitySigningPublicKey" | "name"
>;

export type SafeUserWithDevices = SafeUser & {
  devices: PublicDeviceInfo[];
};

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    verified: user.verified,
    picture: user.picture,
  };
}

export function toPublicDevice(device: Device): PublicDeviceInfo {
  return {
    id: device.id,
    userId: device.userId,
    publicKey: device.publicKey,
    identitySigningPublicKey: device.identitySigningPublicKey,
    name: device.name,
  };
}

export function toSafeUserWithDevices(
  user: User,
  devices: Device[],
): SafeUserWithDevices {
  return {
    ...toSafeUser(user),
    devices: devices.map(toPublicDevice),
  };
}
