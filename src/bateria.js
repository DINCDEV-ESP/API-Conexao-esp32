import mqtt from "mqtt";
import { db } from "./firebase.js";

let client;

/*
=========================
GUARDA ÚLTIMA BATERIA
=========================
*/
const baterias = {};

/*
=========================
EVITA SUBSCRIBE DUPLICADO
=========================
*/
const subscribedTopics = new Set();

/*
=========================
EVITA MÚLTIPLOS LISTENERS
=========================
*/
let usersListenerStarted = false;

/*
=========================
ASSINAR TÓPICO
=========================
*/
function subscribeTopic(mac) {
  if (!mac) return;

  const topic =
    `${mac}/amie/paciente/bateria`;

  /*
    evita subscribe duplicado
  */
  if (subscribedTopics.has(topic)) {
    return;
  }

  client.subscribe(topic, (err) => {
    if (err) {
      console.error(
        `❌ Erro ao assinar ${topic}:`,
        err
      );

      return;
    }

    subscribedTopics.add(topic);

    console.log(
      `🔋 Escutando bateria: ${topic}`
    );
  });
}

/*
=========================
CARREGAR USUÁRIOS
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

    console.log(
      "✅ Usuários carregados"
    );
  } catch (err) {
    console.error(
      "❌ Erro ao carregar usuários:",
      err
    );
  }
}

/*
=========================
LISTENER USUÁRIOS
=========================
*/
function listenForUsers() {
  console.log(
    "👂 Listener de usuários iniciado"
  );

  db.collection("users").onSnapshot(
    (snapshot) => {
      snapshot.docChanges().forEach(
        (change) => {
          /*
            added = novo usuário
            modified = usuário atualizado
          */
          if (
            change.type !== "added" &&
            change.type !== "modified"
          ) {
            return;
          }

          const user =
            change.doc.data();

          if (!user.mac_esp) {
            return;
          }

          console.log(
            `👤 Usuário ${
              change.type === "added"
                ? "novo"
                : "atualizado"
            } detectado`
          );

          subscribeTopic(user.mac_esp);
        }
      );
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
CALCULAR PORCENTAGEM
=========================
*/
function calcularPorcentagem(
  tensao
) {
  /*
    7V = 0%
    12V = 100%
  */
  let porcentagem = Math.round(
    ((tensao - 7) / 5) * 100
  );

  porcentagem = Math.max(
    0,
    Math.min(100, porcentagem)
  );

  return porcentagem;
}

/*
=========================
PROCESSAR MENSAGEM
=========================
*/
function processMessage(
  topic,
  message
) {
  try {
    const rawMessage =
      message.toString();

    console.log(
      "🔋 Raw bateria:",
      rawMessage
    );

    const data = JSON.parse(
      rawMessage
    );

    /*
      pega MAC do tópico
      MAC/amie/paciente/bateria
    */
    const mac = topic.split("/")[0];

    /*
      valida tensão
    */
    const tensao = Number(
      data.voltagem
    );

    if (isNaN(tensao)) {
      console.log(
        "❌ Voltagem inválida"
      );

      return;
    }

    /*
      calcula porcentagem
    */
    const porcentagem =
      calcularPorcentagem(tensao);

    /*
      salva apenas última %
    */
    baterias[mac] =
      porcentagem;

    console.log(
      `🔋 ${mac}: ${porcentagem}%`
    );
  } catch (err) {
    console.error(
      "❌ Erro ao processar bateria:",
      err.message
    );
  }
}

/*
=========================
INICIAR LISTENER
=========================
*/
function initBateriaListener() {
  /*
    evita múltiplas conexões
  */
  if (client) {
    console.log(
      "⚠️ Listener bateria já iniciado"
    );

    return;
  }

  client = mqtt.connect(
    "mqtts://broker.hivemq.com:8883",
    {
      reconnectPeriod: 5000,
      connectTimeout: 4000,
      clean: true,
      clientId:
        "amie-bateria-" +
        Math.random()
          .toString(16)
          .slice(2),
    }
  );

  client.on(
    "connect",
    async () => {
      console.log(
        "✅ MQTT bateria conectado"
      );

      try {
        /*
          usuários já existentes
        */
        await subscribeExistingUsers();

        /*
          listener firestore
        */
        if (
          !usersListenerStarted
        ) {
          listenForUsers();

          usersListenerStarted =
            true;
        }
      } catch (err) {
        console.error(
          "❌ Erro inicializando bateria:",
          err
        );
      }
    }
  );

  client.on(
    "reconnect",
    () => {
      console.log(
        "🔄 Reconectando MQTT bateria..."
      );
    }
  );

  client.on(
    "message",
    processMessage
  );

  client.on("error", (err) => {
    console.error(
      "❌ Erro MQTT bateria:",
      err.message
    );
  });
}

/*
=========================
RETORNAR BATERIA
=========================
*/
function getBateria(mac) {
  if (!mac) {
    return null;
  }

  return baterias[mac] ?? null;
}

export {
  initBateriaListener,
  getBateria,
};