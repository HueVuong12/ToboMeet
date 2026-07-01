// decorators/roles.decorator.ts
import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";
export type MemberRole = "owner" | "admin" | "member";

export const Roles = (...roles: MemberRole[]) => SetMetadata(ROLES_KEY, roles);
