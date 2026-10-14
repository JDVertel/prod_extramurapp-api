import {
  changePassword,
  login,
  requestPasswordReset,
  resetPassword,
} from "../services/auth.service.js";

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