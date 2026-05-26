import mqtt from "mqtt";
import { db } from "./firebase.js";

let client;

// guarda bateria por MAC
const baterias = {};

// evita subscribe duplicado
const subscribedTopics = new Set();

/*
=========================
ASSINAR TÓPICO
=========================
*/
function subscribeTopic(mac) {
  const macFormatado = mac.replace(/:/g, "").toUpperCase();
  const topic = `${macFormatado}/amie/paciente/bateria`;

  if (subscribedTopics.has(topic)) {
    return;
  }

  client.subscribe(topic, (err) => {
    if (err) {
      console.log("Erro ao se inscrever:", err);
      return;
    }

    subscribedTopics.add(topic);
    console.log(`🔋 Escutando bateria: ${topic}`);
  });
}

/*
=========================
CARREGAR USUÁRIOS EXISTENTES
=========================
*/
async function subscribeExistingUsers() {
  try {
    const snapshot = await db.collection("users").get();

    snapshot.forEach((doc) => {
      const user = doc.data();

      if (!user.mac_esp) return;

      subscribeTopic(user.mac_esp);
    });

    console.log("Todas baterias carregadas");
  } catch (err) {
    console.error("Erro ao carregar users:", err);
  }
}

/*
=========================
NOVOS USUÁRIOS
=========================
*/
function listenForNewUsers() {
  db.collection("users").onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const user = change.doc.data();

        if (!user.mac_esp) return;

        console.log("Novo usuário bateria");

        subscribeTopic(user.mac_esp);
      }
    });
  });
}

/*
=========================
INICIAR LISTENER
=========================
*/
function initBateriaListener() {
  client = mqtt.connect("mqtt://broker.hivemq.com:1883");

  client.on("connect", async () => {
    console.log("MQTT bateria conectado");

    await subscribeExistingUsers();
    listenForNewUsers();
  });

  client.on("message", (topic, message) => {
    try {
      const data = JSON.parse(message.toString());

      const mac = topic.split("/")[0];

      let tensao = Number(data.voltagem);

      let porcentagem =
        Math.round(((tensao - 7) / 5) * 100);

      porcentagem =
        Math.max(0, Math.min(100, porcentagem));

      baterias[mac] = porcentagem;

      console.log(
        `${mac}: bateria ${porcentagem}%`
      );

    } catch (err) {
      console.log(
        "Erro ao converter JSON:",
        err.message
      );
    }
  });

  client.on("error", (err) => {
    console.log("Erro MQTT:", err.message);
  });
}

/*
=========================
RETORNAR BATERIA
=========================
*/
function getBateria(mac) {
  const macFormatado =
    mac?.replace(/:/g, "").toUpperCase();

  return baterias[macFormatado] ?? null;
}

export {
  initBateriaListener,
  getBateria
};