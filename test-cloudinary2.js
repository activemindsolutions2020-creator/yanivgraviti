import dotenv from 'dotenv';
dotenv.config();

import { v2 as cloudinary } from 'cloudinary';

// Manually configure with stripped quotes
cloudinary.config({
  cloudinary_url: process.env.CLOUDINARY_URL?.replace(/['"]/g, '')
});

const uploadBufferToCloudinary = (buffer, isPdfFormat = false) => {
  return new Promise((resolve, reject) => {
    const options = { resource_type: "auto", folder: "yaniv_invoices" };
    if (isPdfFormat) options.format = "pdf";
    
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
};

async function run() {
  try {
    const dummyPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 0\n/Kids []\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF");
    const url = await uploadBufferToCloudinary(dummyPdf, true);
    console.log("Success:", url);
  } catch (error) {
    console.error("Cloudinary Error:", error);
  }
}

run();
