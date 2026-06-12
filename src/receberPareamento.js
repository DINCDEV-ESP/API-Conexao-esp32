import mqtt from "mqtt";
import { db } from "./firebase.js";

let mqttClient;

/*
=========================
INICIAR LISTENER
=========================
*/
export function startPairingResponseListener() {
  mqttClient = mqtt.connect(
    "mqtts://broker.hivemq.com:8883",
    {
      reconnectPeriod: 5000,
      connectTimeout: 4000,
      clean: true,
      clientId:
        "amie-pareamento-" +
        Math.random()
          .toString(16)
          .slice(2),
    }
  );

  mqttClient.on("connect", () => {
    console.log(
      "✅ MQTT resposta pareamento conectado"
    );

    mqttClient.subscribe(
      "amie/sistema/resposta_pareamento/+",
      (err) => {
        if (err) {
          console.error(
            "❌ Erro subscribe pareamento:",
            err
          );

          return;
        }

        console.log(
          "📡 Escutando respostas de pareamento"
        );
      }
    );
  });

  mqttClient.on(
    "message",
    async (topic, message) => {
      if (
        !topic.startsWith(
          "amie/sistema/resposta_pareamento/"
        )
      ) {
        return;
      }

      await processPairingResponse(
        topic,
        message
      );
    }
  );

  mqttClient.on(
    "reconnect",
    () => {
      console.log(
        "🔄 Reconectando MQTT pareamento..."
      );
    }
  );

  mqttClient.on("error", (err) => {
    console.error(
      "❌ Erro MQTT pareamento:",
      err
    );
  });
}

/*
=========================
PROCESSAR RESPOSTA
=========================
*/
async function processPairingResponse(
  topic,
  message
) {
  try {
    const data = JSON.parse(
      message.toString()
    );

    console.log(
      "📨 Resposta recebida:",
      data
    );

    if (
      data.confirmado !== true
    ) {
      console.log(
        "⚠️ Pareamento não confirmado"
      );

      return;
    }

    /*
      procura documento ainda válido
    */
    const pairingSnapshot =
      await db
        .collection(
          "device_pairing"
        )
        .where(
          "email",
          "==",
          data.email
        )
        .where(
          "mac_esp",
          "==",
          data.mac
        )
        .limit(1)
        .get();

    if (
      pairingSnapshot.empty
    ) {
      console.log(
        "❌ Solicitação não encontrada ou expirada"
      );

      return;
    }

    const pairingDoc =
      pairingSnapshot.docs[0];

    console.log(
      "✅ Solicitação encontrada"
    );

    /*
      localizar usuário
    */
    const userSnapshot =
      await db
        .collection("users")
        .where(
          "email",
          "==",
          data.email
        )
        .limit(1)
        .get();

    if (
      userSnapshot.empty
    ) {
      console.log(
        "❌ Usuário não encontrado"
      );

      return;
    }

    console.log(
      "✅ Usuário encontrado"
    );

    /*
      salva MAC no usuário
    */
    await userSnapshot.docs[0].ref.update(
      {
        mac_esp: data.mac,
      }
    );

    console.log(
      `✅ MAC ${data.mac} salvo para ${data.email}`
    );

    /*
      remove solicitação
    */
    await pairingDoc.ref.delete();

    console.log(
      "🗑️ Documento de pareamento removido"
    );

    console.log(
      `🎉 Pareamento concluído para ${data.email}`
    );
  } catch (err) {
    console.error(
      "❌ Erro ao processar pareamento:",
      err
    );
  }
}