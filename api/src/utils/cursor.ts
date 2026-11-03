import { Types } from "mongoose";
import { ApiError } from "./ApiError";

// Keyset ("cursor") pagination, newest first. Each page asks for the rows
// after the last one it showed, so page 500 costs the same as page 1, and no
// count of the whole collection is needed.

interface Cursor {
  value: Date | null;
  id: Types.ObjectId;
}

export interface CursorRequest {
  cursor: Cursor | null;
  limit: number;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

/** Reads `?cursor=` and `?limit=` from a request's query string. */
export function cursorParams(query: Record<string, unknown>, defaultLimit = 25): CursorRequest {
  const limit = Math.min(100, Math.max(1, Number(query.limit) || defaultLimit));
  const raw = typeof query.cursor === "string" && query.cursor ? query.cursor : null;
  if (!raw) return { cursor: null, limit };

  try {
    const [value, id] = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as [
      string | null,
      string,
    ];
    if (!Types.ObjectId.isValid(id)) throw new Error("bad id");
    const date = value === null ? null : new Date(value);
    if (date && Number.isNaN(date.getTime())) throw new Error("bad date");
    return { cursor: { value: date, id: new Types.ObjectId(id) }, limit };
  } catch {
    throw ApiError.badRequest("Invalid page link. Go back to the first page.");
  }
}

/**
 * Narrows `filter` to the rows after the cursor, in (field desc, _id desc)
 * order. Rows without the field sort last, as MongoDB sorts them.
 */
export function afterCursor(
  filter: Record<string, unknown>,
  field: string,
  cursor: Cursor | null,
): Record<string, unknown> {
  if (!cursor) return filter;
  const after =
    cursor.value === null
      ? { [field]: null, _id: { $lt: cursor.id } }
      : {
          $or: [
            { [field]: { $lt: cursor.value } },
            { [field]: cursor.value, _id: { $lt: cursor.id } },
            { [field]: null },
          ],
        };
  return { $and: [filter, after] };
}

export function sortFor(field: string): Record<string, -1> {
  return { [field]: -1, _id: -1 };
}

/** Pages are fetched with one row extra; its presence means there is a next page. */
export function toPage<T extends { _id: unknown }>(
  rows: T[],
  limit: number,
  field: keyof T & string,
): CursorPage<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  if (rows.length <= limit || !last) return { items, nextCursor: null };

  const value = last[field] as Date | null | undefined;
  const nextCursor = Buffer.from(
    JSON.stringify([value ? new Date(value).toISOString() : null, String(last._id)]),
  ).toString("base64url");
  return { items, nextCursor };
}
