const fs = require('fs');
const path = require('path');
const { uploadRoot } = require('../middleware/upload.middleware');

class StorageService {
  constructor() {
    this.type = process.env.STORAGE_TYPE || 'local';
  }

  async getFileUrl(filename) {
    if (this.type === 'local') {
      return `${process.env.BASE_URL || 'http://localhost:5000'}/uploads/${filename}`;
    }
    // Future: Add logic for AWS S3 / Cloudinary here
    return `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${filename}`;
  }

  async deleteFile(filename) {
    if (this.type === 'local') {
      const filePath = path.join(uploadRoot, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    // Future: Add S3 delete logic
  }
}

module.exports = new StorageService();
