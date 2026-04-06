import path from 'path';
import fs from 'fs';

const throwError = function (message: string, errorPayload: any = {}, code = 'REMOTE_BAD_REQUEST') {
  console.log(message, errorPayload, code);

  let status = 400; // Default status
  let payload = {};

  if (errorPayload) {
    status = errorPayload?.status || status; // Fallback to default if undefined
    payload = errorPayload?.payload || {};
  }

  const e: any = new Error(message); // Create an error with the provided message
  e.status = status; // Attach status code
  e.payload = payload; // Attach additional payload
  if (code) {
    e.code = code; // Attach code
  }
  throw e; // Throw the customized error
};

const uploadDir = () => {
  const dirPath = path.join(process.cwd(), 'uploads');

  // Create directory if it doesn't exist
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created uploads directory: ${dirPath}`);
  }

  return dirPath;
};

export { throwError, uploadDir };
