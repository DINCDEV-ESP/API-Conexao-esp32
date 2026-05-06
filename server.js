import express from "express";
import enviarRoute from "./src/enviar.js";
import { initReceberListener } from "./src/receber.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// rota
app.use("/", enviarRoute);

// inicia MQTT listener
initReceberListener();

app.get("/", (req, res) => {
  res.send("API rodando...");
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});