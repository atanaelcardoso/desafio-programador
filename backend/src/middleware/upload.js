import multer from 'multer';
import { Buffer } from 'buffer';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {

  if (file.mimetype !== 'application/pdf') {
    return cb(new Error('Apenas arquivos PDF são aceitos'));
  }

  cb(null, true);
};

const limits = {
  fileSize: 50 * 1024 * 1024
};

export const upload = multer({
  storage,
  fileFilter,
  limits
});

export const validatePdfMagicBytes = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }

  const magicBytes = req.file.buffer.slice(0, 4).toString('ascii');
  if (!magicBytes.startsWith('%PDF')) {
    return res.status(400).json({
      error: 'Arquivo corrompido ou não é um PDF válido'
    });
  }

  next();
};

export const validateDocumentType = (req, res, next) => {
  const { tipo } = req.body;

  if (!tipo || !['cartao-ponto', 'holerite'].includes(tipo)) {
    return res.status(400).json({
      error: 'Tipo de documento inválido. Aceitos: cartao-ponto, holerite'
    });
  }

  next();
};

export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'Arquivo muito grande (máximo 50MB)'
      });
    }
  }

  if (err.message) {
    return res.status(400).json({ error: err.message });
  }

  next();
};
