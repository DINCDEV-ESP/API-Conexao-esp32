import admin from "firebase-admin";

let serviceAccount;

try {
  serviceAccount = JSON.parse(
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  );

  console.log("Firebase env carregada");
} catch (err) {
  console.error("Erro lendo GOOGLE_APPLICATION_CREDENTIALS_JSON:", err);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

export { admin, db };