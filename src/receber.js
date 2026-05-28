import mqtt from "mqtt";
import { db, admin } from "./firebase.js";

let client;

const subscribedTopics = new Set();
const processedMessages = new Set();

let usersListenerStarted = false;

/*
  =========================
  CONECTAR MQTT
  =========================
*/
function connectMQTT() {
  client = mqtt.connect("mqtt://broker.hivemq.com", {
    reconnectPeriod: 5000,
  });

  client.on("connect", async () => {
    console.log("✅ MQTT conectado");

    try {
      await subscribeExistingUsers();

      /*
        evita criar múltiplos listeners
      */
      if (!usersListenerStarted) {
        listenForNewUsers();
        usersListenerStarted = true;
      }
    } catch (err) {
      console.error("Erro ao iniciar listeners:", err);
    }
  });

  client.on("reconnect", () => {
    console.log("🔄 Reconectando MQTT...");
  });

  client.on("error", (err) => {
    console.error("❌ Erro MQTT:", err);
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
  if (!mac) return;

  const topic = `${mac}/amie/paciente/status`;

  /*
    evita subscribe duplicado
  */
  if (subscribedTopics.has(topic)) {
    return;
  }

  client.subscribe(topic, (err) => {
    if (err) {
      console.error(`❌ Erro ao assinar ${topic}:`, err);
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
    const snapshot = await db
      .collection("users")
      .get();

    snapshot.forEach((doc) => {
      const user = doc.data();

      if (!user.mac_esp) return;

      subscribeTopic(user.mac_esp);
    });

    console.log("✅ Usuários carregados");
  } catch (err) {
    console.error(
      "❌ Erro ao carregar usuários:",
      err
    );
  }
}

/*
  =========================
  NOVOS USUÁRIOS
  =========================
*/
function listenForNewUsers() {
  console.log(
    "👂 Listener de usuários iniciado"
  );

  db.collection("users").onSnapshot(
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (
          change.type !== "added" &&
          change.type !== "modified"
        ) {
          return;
        }

        const user = change.doc.data();

        if (!user.mac_esp) return;

        /*
          verifica se mac mudou
        */
        if (change.type === "modified") {
          const before =
            change.oldIndex !== -1
              ? snapshot.docs[
                  change.oldIndex
                ]?.data()?.mac_esp
              : null;

          if (before === user.mac_esp) {
            return;
          }
        }

        console.log(
          `📡 Assinando tópico de ${user.mac_esp}`
        );

        subscribeTopic(user.mac_esp);
      });
    },
    (err) => {
      console.error(
        "❌ Erro listener users:",
        err
      );
    }
  );
}

/*
  =========================
  EVITAR MENSAGEM DUPLICADA
  =========================
*/
function isDuplicateMessage(rawMessage) {
  if (processedMessages.has(rawMessage)) {
    return true;
  }

  processedMessages.add(rawMessage);

  /*
    remove após 5 segundos
  */
  setTimeout(() => {
    processedMessages.delete(rawMessage);
  }, 5000);

  return false;
}

/*
  =========================
  PROCESSAR MENSAGEM MQTT
  =========================
*/
async function processMessage(topic, message) {
  try {
    const rawMessage = message.toString();

    /*
      evita mensagens duplicadas
    */
    if (isDuplicateMessage(rawMessage)) {
      console.log("⚠️ Mensagem duplicada ignorada");
      return;
    }

    // console.log("📨 Topic:", topic);
    console.log("📨 Raw:", rawMessage);

    const data = JSON.parse(rawMessage);

    console.log("📦 Dados:", data);

    /*
      validações básicas
    */
    if (!data.email || !data.id_slot) {
      console.log("❌ Dados inválidos");
      return;
    }

    /*
      buscar medicamento
    */
    const medicineSnapshot = await db
      .collection("medicines")
      .where(
        "compartment",
        "==",
        String(data.id_slot)
      )
      .where("email", "==", data.email)
      .limit(1)
      .get();

    if (medicineSnapshot.empty) {
      console.log("❌ Medicamento não encontrado");
      return;
    }

    const medicineDoc = medicineSnapshot.docs[0];
    const medicineRef = medicineDoc.ref;

    /*
      transação evita race condition
    */
    await db.runTransaction(async (transaction) => {
      const medicineTransaction =
        await transaction.get(medicineRef);

      if (!medicineTransaction.exists) {
        throw new Error(
          "Medicamento não existe"
        );
      }

      const medicineData =
        medicineTransaction.data();

      let confirmado =
        data.confirmado ?? false;

      let status =
        data.status ?? "desconhecido";

      /*
        sem comprimidos
      */
      if (
        medicineData.num_comprimidos <= 0
      ) {
        confirmado = false;
        status = "atrasado";

        console.log("⚠️ Sem comprimidos");
      }

      /*
        decrementa comprimido
      */
      else if (
        confirmado === true &&
        status === "tomado"
      ) {
        transaction.update(medicineRef, {
          num_comprimidos:
            medicineData.num_comprimidos - medicineData.dosage,
        });

        console.log(
          "💊 Comprimido decrementado"
        );
      }

      /*
        salva log
      */
      const logRef = db
        .collection("dose_logs")
        .doc();

      transaction.set(logRef, {
        confirmado,
        status,
        gaveta: String(data.id_slot),
        medicine_ref: medicineRef,
        horario_disparo:
          admin.firestore.Timestamp.now(),
        email: data.email,
      });

      console.log("📝 Log salvo");
    });
  } catch (err) {
    console.error(
      "❌ Erro processando mensagem:",
      err
    );
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