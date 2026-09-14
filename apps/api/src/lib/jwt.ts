import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import type { UserRole } from "@prisma/client";
import { env } from "../config/env.js";

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  pharmacyId: string | null;
};

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as StringValue,
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === "string" || !decoded.sub) {
    throw new Error("Invalid token payload");
  }
  return decoded as JwtPayload;
}
