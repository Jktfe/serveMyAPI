/**
 * Shared format for the single-blob key vault.
 *
 * Every keychain-backed store (the legacy `KeychainService` and the
 * `KeychainStorage` provider in the storage abstraction) consolidates all
 * API keys into ONE keychain item stored under {@link VAULT_ACCOUNT}. Keeping
 * the account name and (de)serialisation here — in one place both importers
 * share — guarantees the two implementations never disagree on the blob's
 * shape and so can read each other's writes.
 */

/** Account/identifier under which the whole vault blob is stored. */
export const VAULT_ACCOUNT = '__vault__';

/**
 * Legacy account name from the previous per-key storage scheme. Only
 * referenced during migration so the obsolete marker can be cleaned up.
 */
export const LEGACY_PERMISSION_MARKER = '_permission_granted';

/** Decoded vault: a flat map of key name -> key value. */
export type Vault = Record<string, string>;

/**
 * Decode a raw vault blob. An absent/empty blob yields an empty vault.
 * Invalid JSON throws — callers should treat that as storage corruption
 * rather than silently overwriting it with an empty vault.
 */
export function parseVault(raw: string | null): Vault {
  if (!raw) {
    return {};
  }
  return JSON.parse(raw) as Vault;
}

/** Encode a vault to its stored string form. */
export function serializeVault(vault: Vault): string {
  return JSON.stringify(vault);
}
