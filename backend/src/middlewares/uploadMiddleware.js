const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (_req, file) => ({
    folder: "foodex/menu-items",
    resource_type: "image",
    public_id: `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`,
  }),
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
});

module.exports = {
  upload,
};
