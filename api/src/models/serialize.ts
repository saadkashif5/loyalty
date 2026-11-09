import mongoose, { type Schema } from "mongoose";

// What leaves the API when a document is sent as JSON. Fields that are never
// selected by default (password and MFA secrets, activation codes) and fields
// marked `private: true` (token and code hashes, storage keys) are dropped
// even when a query selected them, so a handler cannot leak one by returning
// the document it just loaded. The version key goes too.

declare module "mongoose" {
  // The type parameter must match Mongoose's own declaration.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SchemaTypeOptions<T> {
    /** Kept in the database, never sent to a client. */
    private?: boolean;
  }
}

function hiddenPaths(schema: Schema): string[] {
  const hidden: string[] = [];
  schema.eachPath((path, type) => {
    const options = type.options as { select?: boolean; private?: boolean };
    if (options.select === false || options.private === true) hidden.push(path);
  });
  return hidden;
}

function removePath(target: Record<string, unknown>, path: string): void {
  const parts = path.split(".");
  let node: unknown = target;
  for (const part of parts.slice(0, -1)) {
    if (!node || typeof node !== "object") return;
    node = (node as Record<string, unknown>)[part];
  }
  if (node && typeof node === "object") delete (node as Record<string, unknown>)[parts.at(-1)!];
}

export function serializePlugin(schema: Schema): void {
  const hidden = hiddenPaths(schema);
  const existing = schema.get("toJSON") ?? {};
  schema.set("toJSON", {
    ...existing,
    versionKey: false,
    transform(_doc: unknown, ret: Record<string, unknown>) {
      for (const path of hidden) removePath(ret, path);
      return ret;
    },
  });
}

mongoose.plugin(serializePlugin);

/**
 * Last line of defence for plain objects (lean queries, toObject()): these
 * names are only ever secrets or internal keys, so they never reach a client.
 */
export const NEVER_SENT = new Set([
  "passwordHash",
  "tokenHash",
  "replacedByTokenHash",
  "codeHash",
  "recoveryCodeHashes",
  "pendingSecret",
  "fileKey",
  "__v",
]);

export function jsonReplacer(key: string, value: unknown): unknown {
  return NEVER_SENT.has(key) ? undefined : value;
}
