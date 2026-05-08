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

      if (snapshot.empty) {
        console.log("Nenhuma medicação encontrada para o slot e email fornecidos");
        return;
      };

      const medicineDoc = snapshot.docs[0];
      const medicineRef = medicineDoc.ref;

      let confirmado = data.confirmado ?? false;
      let status = data.status ?? "desconhecido";

      if (medicineRef) {
        console.log("Referencia ok: ", medicineRef.id);
      }

      if (medicineDoc.data().num_comprimidos <= 0) {
        console.log("Nenhum comprimido restante para a medicação: ", medicineDoc.data().name);
        confirmado = false;
        status = "atrasado";

      }
      else {
        await medicineRef.update({
          num_comprimidos: (medicineRef.num_comprimidos - 1),
        });
      }


        await db.collection("dose_logs").add({

          confirmado: confirmado,
          status: status,
          gaveta: String(data.id_slot),
          medicine_ref: medicineRef,
          horario_disparo: admin.firestore.Timestamp.now(),
          email: data.email,
        });

        //

        console.log("Log salvo");
      } catch (err) {
        console.error(err);
      }
    });
}