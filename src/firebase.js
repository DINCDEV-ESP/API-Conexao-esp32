import admin from "firebase-admin";

let serviceAccount;

try {
  serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT
  );

  console.log("Firebase env carregada");
} catch (err) {
  console.error("Erro lendo FIREBASE_SERVICE_ACCOUNT:", err);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

export { admin, db };