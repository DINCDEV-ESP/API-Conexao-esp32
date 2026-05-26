import mqtt from "mqtt";
import { db } from "./firebase.js";

let bateriaAtual = 0;


function initBateriaListener(email) {
  const client = mqtt.connect("mqtt://broker.hivemq.com");

  const userSnapshot = await db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();

    const mac_esp = userSnapshot.docs[0].data().mac_esp;
    mac_esp = mac_esp.replace(/:/g, "").toUpperCase();

  client.on("connect", () => {
    console.log("Conectado ao broker MQTT");

    client.subscribe(`${mac_esp}/amie/paciente/bateria`, (err) => {
      if (err) {
        console.log("Erro ao se inscrever:", err);
        return;
      }

      console.log("Inscrito no tópico amie/${mac_esp}/paciente/bateria");
    });
  });

  client.on("message", (topic, message) => {
    if (topic !== `${mac_esp}/amie/paciente/bateria`) return;

    try {
      const data = JSON.parse(message.toString());

      console.log("Mensagem recebida:");
      console.log(data);

      var tensao = Number(data.voltagem);
      var porcentagem = Math.round(((tensao - 7) / 5) * 100);
      porcentagem = Math.max(0, Math.min(100, porcentagem));

      console.log("Bateria: " + porcentagem + "%");

      console.log("Nível da bateria:", porcentagem + "%");

      bateriaAtual = porcentagem;
    } catch (err) {
      console.log("Erro ao converter JSON:", err.message);

      // caso venha apenas texto simples
      // console.log("Mensagem bruta:", message.toString());
    }
  });

  client.on("error", (err) => {
    console.log("Erro MQTT:", err.message);
  });
}

function getBateria() {
  return bateriaAtual;
}

export { initBateriaListener, getBateria };