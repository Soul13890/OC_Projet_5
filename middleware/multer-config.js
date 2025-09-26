const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, callback) => {
  const isValidMime = ['image/jpg', 'image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
  if (isValidMime) {
    callback(null, true);
  } else {
    callback(new Error('Format de fichier non supporté.'), false);
  }
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('image');
