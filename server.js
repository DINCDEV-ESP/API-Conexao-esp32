import express from "express";
import enviarRoute from "./src/enviar.js";
import { startMQTTListener } from "./src/receber.js";
import { initBateriaListener, getBateria } from "./src/bateria.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

/*
  rota health check
*/
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

/*
  rota bateria
*/
app.get("/bateria", (req, res) => {
  res.json({
    bateria: getBateria()
  });
});

/*
  rotas envio
*/
app.use("/enviar", enviarRoute);

/*
  subir servidor
*/
app.listen(port, "0.0.0.0", async () => {
  console.log(`Servidor rodando na porta ${port}`);

  // listener principal MQTT
  startMQTTListener();

  // listener bateria
  initBateriaListener();
});