import mqtt from "mqtt";
import { db, admin } from "./firebase.js";

let client;
const subscribedTopics = new Set();

/*
  =========================
  CONECTAR MQTT
  =========================
*/
function connectMQTT() {
  client = mqtt.connect("mqtt://broker.hivemq.com");

  client.on("connect", async () => {
    console.log("✅ MQTT conectado");

    await subscribeExistingUsers();
    listenForNewUsers();
  });

  client.on("error", (err) => {
    console.error("Erro MQTT:", err);
  });

  client.on("message", async (topic, message) => {
    await processMessage(topic, message);
  });
}

/*
  =========================
  ASSINAR TÓPICO
  =========================
*/
function subscribeTopic(mac) {
  
  mac = mac.replace(/:/g, "").toUpperCase();

  const topic = `${mac}/amie/paciente/status`;

  if (subscribedTopics.has(topic)) {
    return;
  }

  client.subscribe(topic, (err) => {
    if (err) {
      console.log(`Erro ao assinar ${topic}`);
      return;
    }

    subscribedTopics.add(topic);
    console.log(`📡 Escutando: ${topic}`);
  });
}

/*
  =========================
  USUÁRIOS EXISTENTES
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

    console.log("✅ Todos usuários carregados");
  } catch (err) {
    console.error("Erro ao carregar usuários:", err);
  }
}

/*
  =========================
  NOVOS USUÁRIOS
  =========================
*/
function listenForNewUsers() {
  db.collection("users").onSnapshot(
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const user = change.doc.data();

          if (!user.mac_esp) return;

          console.log("Novo usuário detectado");

          subscribeTopic(user.mac_esp);
        }
      });
    },
    (err) => {
      console.error("Erro listener users:", err);
    }
  );
}

/*
  =========================
  PROCESSAR MENSAGEM MQTT
  =========================
*/
async function processMessage(topic, message) {
  try {
    const data = JSON.parse(message.toString());

    console.log("Mensagem recebida:", data);

    // const mac = topic.split("/")[1];

    // /*
    //   achar usuário pelo mac
    // */
    // const userSnapshot = await db
    //   .collection("users")
    //   .where("mac_esp", "==", mac)
    //   .limit(1)
    //   .get();

    // if (userSnapshot.empty) {
    //   console.log("Usuário não encontrado");
    //   return;
    // }

    // const email = userSnapshot.docs[0].data().email;

    /*
      achar medicamento
    */
    const medicineSnapshot = await db
      .collection("medicines")
      .where("compartment", "==", String(data.id_slot))
      .where("email", "==", data.email)
      .limit(1)
      .get();

    if (medicineSnapshot.empty) {
      console.log("Medicamento não encontrado");
      return;
    }

    const medicineDoc = medicineSnapshot.docs[0];
    const medicineRef = medicineDoc.ref;
    const medicineData = medicineDoc.data();

    let confirmado = data.confirmado ?? false;
    let status = data.status ?? "desconhecido";

    /*
      verifica comprimidos
    */
    if (medicineData.num_comprimidos <= 0) {
      confirmado = false;
      status = "atrasado";

      console.log("Sem comprimidos");
    }

    /*
      decrementa
    */
    else if (
      confirmado === true &&
      status === "tomado"
    ) {
      await medicineRef.update({
        num_comprimidos:
          medicineData.num_comprimidos - 1,
      });

      console.log("Comprimido decrementado");
    }

    /*
      salva log
    */
    await db.collection("dose_logs").add({
      confirmado,
      status,
      gaveta: String(data.id_slot),
      medicine_ref: medicineRef,
      horario_disparo:
        admin.firestore.Timestamp.now(),
      email: data.email,
    });

    console.log("Log salvo");
  } catch (err) {
    console.error("Erro processando:", err);
  }
}

/*
  =========================
  INICIAR
  =========================
*/
export function startMQTTListener() {
  connectMQTT();
}