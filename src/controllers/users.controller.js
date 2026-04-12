import { bulkCreateUsers, bulkCreateUsersFromCsv } from "../services/user.service.js";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configuración de multer para guardar archivos temporalmente
const upload = multer({ dest: "uploads/" });

// Carga masiva de usuarios desde archivo CSV
export const bulkCreateUsersController = [
  upload.single("file"),
  async (req, res) => {
    const hasJsonUsers = Array.isArray(req.body?.users) && req.body.users.length > 0;
    const hasUploadedFile = Boolean(req.file);

    if (!hasJsonUsers && !hasUploadedFile) {
      return res.status(400).json({ message: "No se recibieron usuarios ni archivo CSV" });
    }

    let filePath = null;

    try {
      let result;

      if (hasJsonUsers) {
        result = await bulkCreateUsers(req.body.users, req.user);
      } else {
        filePath = path.resolve(req.file.path);
        result = await bulkCreateUsersFromCsv(filePath, req.user);
      }

      res.status(201).json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ message: err.message });
    } finally {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }
];
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