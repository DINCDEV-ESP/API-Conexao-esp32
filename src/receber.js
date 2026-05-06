import mqtt from "mqtt";
import { admin, db } from "./firebase.js";

let client;

export function initReceberListener() {
  client = mqtt.connect("mqtt://broker.hivemq.com");

  client.on("connect", () => {
    console.log("MQTT recebimento conectado");
    client.subscribe("dinc/paciente/status");
  });

  client.on("message", async (topic, message) => {
    if (topic !== "dinc/paciente/status") return;

    try {
      const data = JSON.parse(message.toString());
      console.log("Recebido:", data);

      const snapshot = await db
        .collection("medicines")
        .where("compartment", "==", String(data.id_slot))
        .where("email", "==", data.email)
        .limit(1)
        .get();

      if (snapshot.empty) return;

      const medicineDoc = snapshot.docs[0];
      const medicineRef = medicineDoc.ref;

      await db.collection("dose_logs").add({
        confirmado: data.confirmado ?? false,
        status: data.status ?? "desconhecido",
        gaveta: String(Number(data.id_slot) - 1),
        medicine_ref: medicineRef,
        horario_disparo: admin.firestore.Timestamp.now(),
        email: data.email,
      });

      console.log("Log salvo");
    } catch (err) {
      console.error(err);
    }
  });
}