import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { db } from "./db";
const key = () => new TextEncoder().encode(process.env.AUTH_SECRET!);
export async function setSession(uid: string) {
  const t = await new SignJWT({ uid }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("8h").sign(key());
  cookies().set("s", t, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
}
export async function requireUser(roles?: Role[]) {
  const t = cookies().get("s")?.value;
  let u = null;
  try { if (t) u = await db.user.findUnique({ where: { id: (await jwtVerify(t, key())).payload.uid as string } }); } catch {}
  if (!u || !u.active) redirect("/login");
  if (roles && !roles.includes(u.role)) throw new Error("Forbidden");
  return u;
}
