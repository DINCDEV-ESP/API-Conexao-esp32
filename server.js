import express from "express";

import enviarRoute from "./src/enviar.js";

import { startMQTTListener }
  from "./src/receber.js";

import {
  initBateriaListener,
  getBateria,
} from "./src/bateria.js";

import {
  startPairingListener,
} from "./src/enviarPareamento.js";

import {
  startPairingResponseListener,
} from "./src/receberPareamento.js";

const app = express();
const port =
  process.env.PORT || 3000;

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

    if (
      !listenersStarted
    ) {
      listenersStarted =
        true;

      startMQTTListener();

      initBateriaListener();

      startPairingListener();

      startPairingResponseListener();

      console.log(
        "✅ Todos os listeners iniciados"
      );
    }
  }
);