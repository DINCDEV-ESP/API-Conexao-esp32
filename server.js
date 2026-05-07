import express from "express";
import enviarRoute from "./src/enviar.js";
import { initReceberListener } from "./src/receber.js";
import { initBateriaListener } from "./src/bateria.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// rota
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.use("/enviar", enviarRoute);

app.listen(port, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${port}`);
  initReceberListener();
  initBateriaListener();
});