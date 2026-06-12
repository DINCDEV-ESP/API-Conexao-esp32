/*
=========================
INSCREVER TÓPICO
=========================
*/
mqttClient.subscribe(
  "amie/sistema/resposta_pareamento/+"
);

/*
=========================
RECEBER RESPOSTAS
=========================
*/
mqttClient.on("message", async (topic, message) => {
  if (
    !topic.startsWith(
      "amie/sistema/resposta_pareamento/"
    )
  ) {
    return;
  }

  await processPairingResponse(message);
});

/*
=========================
PROCESSAR RESPOSTA
=========================
*/
async function processPairingResponse(
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

    /*
      precisa estar confirmado
    */
    if (
      data.confirmado !== true
    ) {
      return;
    }

    /*
      procura solicitação pendente
    */
    const pairingSnapshot =
      await db
        .collection(
          "pairing_requests"
        )
        .where(
          "email",
          "==",
          data.email
        )
        .where(
          "mac_digitado",
          "==",
          data.mac
        )
        .where(
          "pendencia",
          "==",
          true
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

    /*
      horário requisição
    */
    const horarioRequisicao =
      pairingData.horario_requisicao
        .toDate();

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
      "⏱ Diferença:",
      diferencaSegundos
    );

    /*
      precisa estar entre 0 e 10 segundos
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