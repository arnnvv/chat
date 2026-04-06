import {
  concat,
  ed25519Verify,
  generateX25519KeyPair,
  hkdfDerive,
  x25519DH,
} from "./primitives";

const ZERO_SALT = new Uint8Array(32);

export interface KeyBundle {
  identityKey: Uint8Array;
  identityDHKey: Uint8Array;
  signedPreKey: Uint8Array;
  signedPreKeySig: Uint8Array;
  signedPreKeyId: number;
  oneTimePreKey?: Uint8Array;
  oneTimePreKeyId?: number;
}

export interface X3DHResult {
  sharedSecret: Uint8Array;
  ephemeralPublicKey: Uint8Array;
  usedSignedPreKeyId: number;
  usedOneTimePreKeyId?: number;
}

function deriveSharedSecret(dhParts: Uint8Array[]): Uint8Array {
  return hkdfDerive(concat(...dhParts), ZERO_SALT, "X3DH", 32);
}

export async function initiateX3DH(
  ownIdentityPrivate: Uint8Array,
  ownIdentityPublic: Uint8Array,
  remoteBundle: KeyBundle,
): Promise<X3DHResult> {
  const isValidSignedPreKey = ed25519Verify(
    remoteBundle.identityKey,
    remoteBundle.signedPreKey,
    remoteBundle.signedPreKeySig,
  );

  if (!isValidSignedPreKey) {
    throw new Error("Remote signed pre-key signature is invalid.");
  }

  const ephemeralKeyPair = generateX25519KeyPair();
  const dhParts = [
    x25519DH(ownIdentityPrivate, remoteBundle.signedPreKey),
    x25519DH(ephemeralKeyPair.privateKey, remoteBundle.identityDHKey),
    x25519DH(ephemeralKeyPair.privateKey, remoteBundle.signedPreKey),
  ];

  if (remoteBundle.oneTimePreKey) {
    dhParts.push(
      x25519DH(ephemeralKeyPair.privateKey, remoteBundle.oneTimePreKey),
    );
  }

  return {
    sharedSecret: deriveSharedSecret(dhParts),
    ephemeralPublicKey: ephemeralKeyPair.publicKey,
    usedSignedPreKeyId: remoteBundle.signedPreKeyId,
    usedOneTimePreKeyId: remoteBundle.oneTimePreKeyId,
  };
}

export async function respondX3DH(
  ownIdentityDHPrivate: Uint8Array,
  ownSignedPreKeyPrivate: Uint8Array,
  ownOneTimePreKeyPrivate: Uint8Array | null,
  remoteIdentityDHPublic: Uint8Array,
  remoteEphemeralPublic: Uint8Array,
): Promise<Uint8Array> {
  const dhParts = [
    x25519DH(ownSignedPreKeyPrivate, remoteIdentityDHPublic),
    x25519DH(ownIdentityDHPrivate, remoteEphemeralPublic),
    x25519DH(ownSignedPreKeyPrivate, remoteEphemeralPublic),
  ];

  if (ownOneTimePreKeyPrivate) {
    dhParts.push(x25519DH(ownOneTimePreKeyPrivate, remoteEphemeralPublic));
  }

  return deriveSharedSecret(dhParts);
}
