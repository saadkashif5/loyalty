import type { UserDocument } from "@/models";

export function toPublicUser(user: UserDocument) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    status: user.status,
    platformRole: user.platformRole,
    createdAt: user.createdAt,
  };
}
