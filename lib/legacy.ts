// Historical identifiers are read only for migration compatibility.
// New writes, configuration and public branding use BMTI.
export const legacy = {
  adminCookie: "hgp_admin",
  visitorCookie: "hgp_visitor",
  draftPrefix: "hgp-draft-",
  migrationTable: "_hgp_migrations",
} as const;

export function environmentValue(name: string, values: Record<string, string | undefined>) {
  return values[name] || values[name.replace(/^BMTI_/, "HGP_")];
}

export function displayVersion(version: string) {
  return version.replace(/^HGP-/, "BMTI-");
}

export function draftKey(id: string) {
  return "bmti-draft-" + id;
}

export function readDraft(storage: Pick<Storage, "getItem">, id: string) {
  return storage.getItem(draftKey(id)) ?? storage.getItem(legacy.draftPrefix + id);
}

export function clearDraft(storage: Pick<Storage, "removeItem">, id: string) {
  storage.removeItem(draftKey(id));
  storage.removeItem(legacy.draftPrefix + id);
}
