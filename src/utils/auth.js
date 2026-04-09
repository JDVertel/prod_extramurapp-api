import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "./config.js";

export async function hashPassword(plainText) {
  return bcrypt.hash(plainText, 10);
}

export async function verifyPassword(plainText, passwordHash) {
  return bcrypt.compare(plainText, passwordHash);
}

export function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}
