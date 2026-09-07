import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

function resolveServiceAccountPath() {
  const configuredPath =
    process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!configuredPath) return null;
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);
}

export function getFirebaseAdmin() {
  if (admin.apps.length) return admin;

  const serviceAccountPath = resolveServiceAccountPath();
  if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
    console.warn('Firebase service account file missing. FCM will run in mock mode.');
    return null;
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
  });

  return admin;
}
