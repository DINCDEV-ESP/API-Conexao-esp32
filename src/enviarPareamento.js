import mqtt from "mqtt";
import { db } from "./firebase.js";

let mqttClient;

const pendingRequests = new Map();

export function startPairingListener() {
    mqttClient = mqtt.connect(
        "mqtts://broker.hivemq.com:8883"
    );

    mqttClient.on("connect", () => {
        console.log(
            "✅ MQTT pareamento conectado"
        );

        listenFirestore();
    });

    mqttClient.on("error", (err) => {
        console.error(
            "❌ Erro MQTT pareamento:",
            err
        );
    });
}

function listenFirestore() {
    db.collection("pairing_requests")
        .where("pendencia", "==", true)
        .onSnapshot(
            (snapshot) => {
                snapshot
                    .docChanges()
                    .forEach((change) => {
                        if (
                            change.type !== "added"
                        ) {
                            return;
                        }

                        processRequest(
                            change.doc
                        );
                    });
            },
            (err) => {
                console.error(
                    "❌ Erro listener pareamento:",
                    err
                );
            }
        );
}

async function processRequest(
    doc
) {
    try {
        const data = doc.data();

        const mac =
            data.mac_digitado;

        if (!mac) {
            return;
        }

        /*
          evita processar duas vezes
        */
        if (
            pendingRequests.has(
                doc.id
            )
        ) {
            return;
        }

        console.log(
            `📡 Enviando pareamento para ${mac}`
        );

        const dataHora = data.time_req.toDate();

        const horario = dataHora.toLocaleTimeString(
            "pt-BR",
            {
                hour12: false,
            }
        );

        const payload = {
            mac: data.mac_esp,
            email: data.email,
            horario,
        };

        mqttClient.publish(
            `amie/sistema/requisicao_pareamento/${mac}`,
            JSON.stringify(
                payload
            )
        );

        pendingRequests.set(
            doc.id,
            true
        );

        /*
          expira em 10s
        */
        setTimeout(
            async () => {
                try {
                    const currentDoc =
                        await doc.ref.get();

                    if (
                        currentDoc.exists
                    ) {
                        const currentData =
                            currentDoc.data();

                        if (
                            currentData.pendencia ===
                            true
                        ) {
                            console.log(
                                `⏰ Pareamento expirado ${mac}`
                            );

                            await doc.ref.delete();
                        }
                    }

                    pendingRequests.delete(
                        doc.id
                    );
                } catch (err) {
                    console.error(
                        "Erro timeout pareamento:",
                        err
                    );
                }
            },
            10000
        );
    } catch (err) {
        console.error(
            "Erro processando pareamento:",
            err
        );
    }
}