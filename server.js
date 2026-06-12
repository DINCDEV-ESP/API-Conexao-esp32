import express from "express";

import enviarRoute from "./src/enviar.js";
import { startPairingListener } from "./src/enviarPareamento.js";
import { processPairingResponse } from "./src/receberPareamento.js";


import { startMQTTListener } from "./src/receber.js";
import {
  initBateriaListener,
  getBateria,
} from "./src/bateria.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

/*
=========================
HEALTH CHECK
=========================
*/
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

/*
=========================
BATERIA
=========================
*/
app.get("/bateria", (req, res) => {
  try {
    const mac = req.query.mac
      ?.trim()
      .toUpperCase();

    if (!mac) {
      return res.status(400).json({
        success: false,
        message:
          "Parâmetro mac é obrigatório",
      });
    }

    const bateria =
      getBateria(mac);

    return res.json({
      success: true,
      mac,
      bateria:
        bateria ?? null,
    });
  } catch (err) {
    console.error(
      "Erro rota bateria:",
      err
    );

    return res.status(500).json({
      success: false,
      message:
        "Erro interno",
    });
  }
});

/*
=========================
ENVIO MEDICAMENTOS
=========================
*/
app.use(
  "/enviar",
  enviarRoute
);

/*
=========================
PAREAMENTO ESP
=========================
*/
app.use(
  "/pareamento",
  pareamentoRoute
);

/*
=========================
INICIAR LISTENERS
=========================
*/
let listenersStarted = false;

/*
=========================
SUBIR SERVIDOR
=========================
*/
app.listen(
  port,
  "0.0.0.0",
  () => {
    console.log(
      `🚀 Servidor rodando na porta ${port}`
    );

    /*
      Railway pode reiniciar containers.
      Evita iniciar listeners duas vezes.
    */
    if (
      !listenersStarted
    ) {
      listenersStarted =
        true;

      startMQTTListener();

      initBateriaListener();

      processPairingResponse();

      startPairingListener();

      console.log(
        "✅ Listeners iniciados"
      );
    }
  }
);