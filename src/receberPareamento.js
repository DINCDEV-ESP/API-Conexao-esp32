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
      procura solicitação pendente
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
        "❌ Solicitação não encontrada"
      );

      return;
    }

    const pairingDoc =
      pairingSnapshot.docs[0];

    const pairingData =
      pairingDoc.data();

    console.log(
      "📄 Dados encontrados no Firestore:",
      pairingData
    );

    /*
      horário da requisição
    */
    const horarioRequisicao =
      pairingData.time_req.toDate();

    /*
      horário clique
      formato:
      11/06/2026 16:47:31
    */
    const horarioClique =
      parseDateBR(
        data.horario_clique
      );

    const diferencaSegundos =
      (
        horarioClique -
        horarioRequisicao
      ) / 1000;

    console.log(
      `⏱ Diferença: ${diferencaSegundos}s`
    );

    /*
      máximo 10 segundos
    */
    if (
      diferencaSegundos < 0 ||
      diferencaSegundos > 10
    ) {
      console.log(
        "❌ Janela de pareamento expirada"
      );

      return;
    }

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

    /*
      salva MAC
    */
    await userSnapshot.docs[0].ref.update(
      {
        mac_esp: data.mac,
      }
    );

    /*
      remove solicitação
    */
    await pairingDoc.ref.delete();

    console.log(
      `✅ Pareamento concluído para ${data.email}`
    );
  } catch (err) {
    console.error(
      "❌ Erro ao processar pareamento:",
      err
    );
  }
}

/*
=========================
DD/MM/YYYY HH:mm:ss
→ Date
=========================
*/
function parseDateBR(
  dateString
) {
  const [
    data,
    hora,
  ] = dateString.split(" ");

  const [
    dia,
    mes,
    ano,
  ] = data.split("/");

  const [
    h,
    m,
    s,
  ] = hora.split(":");

  return new Date(
    Number(ano),
    Number(mes) - 1,
    Number(dia),
    Number(h),
    Number(m),
    Number(s)
  );
}