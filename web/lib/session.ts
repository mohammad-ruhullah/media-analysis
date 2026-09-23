import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Role } from "@/types/next-auth";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

export function homeFor(roles: Role[]): string {
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("analyst")) return "/analyst";
  if (roles.includes("editor")) return "/editor";
  return "/login";
}

export async function requireRole(roles: Role[]) {
  const user = await requireUser();
  if (!roles.some((r) => user.roles.includes(r))) {
    redirect(homeFor(user.roles));
  }
  return user;
}

export function hasRole(userRoles: Role[], role: Role) {
  return userRoles.includes(role);
}