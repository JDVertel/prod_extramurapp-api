import {
  checkDocumentExists,
  checkEmailExists,
  createUserRecord,
  deleteUserRecord,
  getDelegatedProfessionals,
  getUserById,
  getUsers,
  updateUserPasswordRecord,
  updateUserRecord,
  unlockUserRecord,
} from "../services/user.service.js";

export async function existsByEmailController(req, res) {
  res.json(await checkEmailExists(req.params.email));
}

export async function existsByDocumentController(req, res) {
  res.json(await checkDocumentExists(req.params.numDocumento));
}

export async function listUsersController(_req, res) {
  res.json(await getUsers(_req.user));
}

export async function getUserByIdController(req, res) {
  res.json(await getUserById(req.params.id, req.user));
}

export async function listDelegatedProfessionalsController(req, res) {
  res.json(await getDelegatedProfessionals(req.user));
}

export async function createUserController(req, res) {
  res.status(201).json(await createUserRecord(req.body || {}, req.user));
}

export async function updateUserController(req, res) {
  res.json(await updateUserRecord(req.params.id, req.body || {}, req.user));
}

export async function deleteUserController(req, res) {
  res.json(await deleteUserRecord(req.params.id, req.user));
}

export async function updateUserPasswordController(req, res) {
  res.json(await updateUserPasswordRecord(req.params.id, req.body || {}, req.user));
}

export async function unlockUserController(req, res) {
  res.json(await unlockUserRecord(req.params.id, req.user));
}