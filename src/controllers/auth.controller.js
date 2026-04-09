import {
  changePassword,
  login,
  registerAdmin,
  requestPasswordReset,
  resetPassword,
} from "../services/auth.service.js";

export async function registerAdminController(req, res) {
  const data = await registerAdmin(req.body || {});
  res.status(201).json(data);
}

export async function loginController(req, res) {
  res.json(await login(req.body || {}));
}

export async function requestPasswordResetController(req, res) {
  res.json(await requestPasswordReset(req.body || {}));
}

export async function resetPasswordController(req, res) {
  res.json(await resetPassword(req.body || {}));
}

export async function changePasswordController(req, res) {
  res.json(await changePassword(req.user.sub, req.body || {}));
}