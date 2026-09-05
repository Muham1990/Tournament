import multer from "multer";
import path from "path";
import fs from "fs";
import { AppError } from "../utils/errors.js";

const uploadRoot = path.resolve(
  process.env.UPLOAD_DIR
    ? path.resolve(process.cwd(), process.env.UPLOAD_DIR)
    : path.resolve(__dirname, "../../../uploads"),
);

if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (!allowed.has(file.mimetype)) {
    cb(new AppError("FILE_TYPE", "Разрешены только JPG, JPEG, PNG, WEBP"));
    return;
  }
  cb(null, true);
};

const maxBytes = (Number(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024;

export const upload = multer({
  storage,
  limits: { fileSize: maxBytes },
  fileFilter,
});

export const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(maxBytes, 8 * 1024 * 1024) },
  fileFilter,
});

export const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype || "";
    const name = (file.originalname || "").toLowerCase();
    const audioExt = /\.(webm|wav|mp3|m4a|aac|ogg|oga|3gp|3gpp|mp4|caf|amr)$/.test(name);
    if (
      mime.startsWith("audio/")
      || mime === "video/webm"
      || mime === "video/mp4"
      || mime === "video/3gpp"
      || mime === "application/octet-stream"
      || audioExt
    ) {
      cb(null, true);
      return;
    }
    cb(new AppError("FILE_TYPE", "Нужен аудиофайл."));
  },
});

export { uploadRoot };
