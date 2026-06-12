import mqtt from "mqtt";
import { db } from "./firebase.js";

let mqttClient;

const pendingRequests = new Map();

export function startPairingListener() {
  console.log(
    "🚀 Iniciando listener de pareamento..."
  );

  mqttClient = mqtt.connect(
    "mqtts://broker.hivemq.com:8883",
    {
      reconnectPeriod: 5000,
      connectTimeout: 5000,
      clean: true,
      clientId:
        "amie-pairing-" +
        Math.random()
          .toString(16)
          .slice(2),
    }
  );

  mqttClient.on("connect", () => {
    console.log(
      "✅ MQTT pareamento conectado"
    );

    listenFirestore();
  });

  mqttClient.on("reconnect", () => {
    console.log(
      "🔄 Reconectando MQTT pareamento..."
    );
  });

  mqttClient.on("error", (err) => {
    console.error(
      "❌ Erro MQTT pareamento:",
      err
    );
  });
}

/*
=========================
LISTENER FIRESTORE
=========================
*/
function listenFirestore() {
  console.log(
    "👂 Escutando coleção device_pairing..."
  );

  db.collection("device_pairing").onSnapshot(
    (snapshot) => {
      snapshot.docChanges().forEach(
        (change) => {
          console.log(
            `📄 Alteração detectada: ${change.type}`
          );

          if (
            change.type !== "added" &&
            change.type !== "modified"
          ) {
            return;
          }

          processRequest(
            change.doc
          );
        }
      );
    },
    (err) => {
      console.error(
        "❌ Erro listener Firestore:",
        err
      );
    }
  );
}

/*
=========================
PROCESSAR SOLICITAÇÃO
=========================
*/
async function processRequest(
  doc
) {
  try {
    const data = doc.data();

    console.log(
      "📥 Documento recebido:",
      doc.id,
      data
    );

    const mac =
      data.mac_esp?.trim()
        .toUpperCase();

    const email =
      data.email?.trim();

    if (!mac) {
      console.log(
        `⚠️ Documento ${doc.id} sem MAC`
      );

      return;
    }

    if (!email) {
      console.log(
        `⚠️ Documento ${doc.id} sem email`
      );

      return;
    }

    /*
      evita reprocessar
    */
    if (
      pendingRequests.has(
        doc.id
      )
    ) {
      console.log(
        `⚠️ Documento ${doc.id} já está sendo processado`
      );

      return;
    }

    const horario =
      data.time_req
        ?.toDate()
        ?.toLocaleTimeString(
          "pt-BR",
          {
            hour12: false,
          }
        );

    if (!horario) {
      console.log(
        `⚠️ Documento ${doc.id} sem horário`
      );

      return;
    }

    const payload = {
      mac,
      email,
      horario,
    };

    console.log(
      "📡 Publicando MQTT:"
    );
    console.log(
      "📍 Tópico:",
      `amie/sistema/requisicao_pareamento/${mac}`
    );
    console.log(
      "📦 Payload:",
      payload
    );

    mqttClient.publish(
      `amie/sistema/requisicao_pareamento/${mac}`,
      JSON.stringify(
        payload
      ),
      (err) => {
        if (err) {
          console.error(
            "❌ Erro publish MQTT:",
            err
          );

          return;
        }

        console.log(
          `✅ Solicitação enviada para ${mac}`
        );
      }
    );

    pendingRequests.set(
      doc.id,
      true
    );

    console.log(
      `⏳ Timeout iniciado (${doc.id})`
    );

    /*
      expira após 10 segundos
    */
    setTimeout(
      async () => {
        try {
          const currentDoc =
            await doc.ref.get();

          if (
            currentDoc.exists
          ) {
            console.log(
              `⏰ Timeout atingido para ${mac}`
            );

            await doc.ref.delete();

            console.log(
              `🗑️ Documento removido: ${doc.id}`
            );
          } else {
            console.log(
              `✅ Documento ${doc.id} já foi removido`
            );
          }
        } catch (err) {
          console.error(
            "❌ Erro timeout:",
            err
          );
        } finally {
          pendingRequests.delete(
            doc.id
          );

          console.log(
            `🧹 Limpeza concluída para ${doc.id}`
          );
        }
      },
      10000
    );
  } catch (err) {
    console.error(
      "❌ Erro processando solicitação:",
      err
    );
  }
}