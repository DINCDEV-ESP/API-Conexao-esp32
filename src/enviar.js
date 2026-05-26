import { Router } from "express";
import mqtt from "mqtt";
import { db } from "./firebase.js";

const router = Router();
const client = mqtt.connect("mqtt://broker.hivemq.com");

client.on("connect", () => {
  console.log("MQTT de envio conectado");
});

client.on("error", (error) => {
  console.error("Erro no MQTT:", error.message);
});

async function enviarRemedios(req, res) {
  const { email } = req.body ?? {};

  if (!email) {
    return res.status(400).json({ error: "Email é obrigatório" });
  }

  try {

    const userSnapshot = await db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();

    const mac_esp = userSnapshot.docs[0].data().mac_esp;
    mac_esp = mac_esp.replace(/:/g, "").toUpperCase();

    const medicinesSnapshot = await db
      .collection("medicines")
      .where("email", "==", email)
      .get();

    let enviados = 0;

    for (const medicineDoc of medicinesSnapshot.docs) {
      const med = medicineDoc.data();
      const medicineRef = db.collection("medicines").doc(medicineDoc.id);

      const schedulesSnapshot = await db
        .collection("schedules")
        .where("medicine_ref", "==", medicineRef)
        .get();

      const horarios = [];

      schedulesSnapshot.forEach((scheduleDoc) => {
        const schedule = scheduleDoc.data();

        if (!schedule.time) return;

        const date =
          typeof schedule.time.toDate === "function"
            ? schedule.time.toDate()
            : new Date(schedule.time);

        if (Number.isNaN(date.getTime())) return;

        horarios.push(
          date.toLocaleTimeString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        );
      });

      horarios.sort((a, b) => {
        const [h1, m1] = a.split(":").map(Number);
        const [h2, m2] = b.split(":").map(Number);
        return h1 * 60 + m1 - (h2 * 60 + m2);
      });

      const payload = {
        id: parseInt(med.compartment, 10),
        nome: med.name,
        horarios_lista: horarios,
        dose: med.dosage,
        dias: [true, true, true, true, true, true, true],
        email,
      };

      console.log("Enviando:", payload);

      client.publish(`${mac_esp}/amie/config/remedios`, JSON.stringify(payload));
      enviados++;
      console.log("Publicado no MQTT:", payload);

      await new Promise((r) => setTimeout(r, 300));
    }

    //client.publish(`${mac_esp}/amie/config/remedios`, "done");

    return res.json({ success: true, enviados });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro interno" });
  }
}

router.post("/", enviarRemedios);

export default router;