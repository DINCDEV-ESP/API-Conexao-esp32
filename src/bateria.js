import mqtt from "mqtt";

let bateriaAtual = 0;


function initBateriaListener() {
  const client = mqtt.connect("mqtt://broker.hivemq.com");

  client.on("connect", () => {
    console.log("Conectado ao broker MQTT");

    client.subscribe("dinc/paciente/bateria", (err) => {
      if (err) {
        console.log("Erro ao se inscrever:", err);
        return;
      }

      console.log("Inscrito no tópico dinc/paciente/bateria");
    });
  });

  client.on("message", (topic, message) => {
    if (topic !== "dinc/paciente/bateria") return;

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