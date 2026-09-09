import bcrypt from "bcryptjs";

/**
 * Kept separate from auth.ts so scripts (the seeder) can hash a password
 * without pulling in next/headers and next/navigation.
 */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
