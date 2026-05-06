import admin from "firebase-admin";
import fs from "fs";

let serviceAccount;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  // 🚂 Railway
  serviceAccount = JSON.parse(
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  );
} else {
  // 💻 Local
  serviceAccount = JSON.parse(
    fs.readFileSync("./dinc-c1e06-firebase-adminsdk-fbsvc-16dda2d491.json", "utf-8")
  );
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

export { admin, db };