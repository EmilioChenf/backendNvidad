require('dotenv').config();
const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Endpoint para obtener los participantes
app.get("/participants", async (req, res) => {
  try {
    const snapshot = await db.collection("participants").get();
    const participants = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json(participants);
  } catch (error) {
    console.error("Error al obtener participantes:", error);
    res.status(500).json({ error: "Error al obtener participantes." });
  }
});

// Endpoint para agregar la lista de deseos
app.post("/addWishlist", async (req, res) => {
  const { name, wishlist } = req.body;

  if (!name || !wishlist || !Array.isArray(wishlist) || wishlist.length > 10) {
    return res.status(400).json({
      error: "Nombre y lista de deseos son obligatorios, y la lista debe tener un máximo de 10 ítems.",
    });
  }

  try {
    const snapshot = await db
      .collection("participants")
      .where("name", "==", name)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: "El participante no existe." });
    }

    const participantRef = snapshot.docs[0].ref;
    await participantRef.update({ wishlist });
    res.status(200).json({ message: "Lista de deseos guardada correctamente." });
  } catch (error) {
    console.error("Error al guardar la lista de deseos:", error);
    res.status(500).json({ error: "Error al guardar la lista de deseos." });
  }
});

// Endpoint para realizar el sorteo
app.post("/draw", async (req, res) => {
  const { excludeName } = req.body;

  try {
    const snapshot = await db.collection("participants").get();
    let participants = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Filtrar los participantes excluidos o que ya realizaron el sorteo
    participants = participants.filter(
      (participant) =>
        participant.name !== excludeName &&
        !participant.excluded &&
        !participant.hasDrawn
    );

    if (participants.length === 0) {
      return res.status(404).json({ error: "No hay más participantes disponibles para el sorteo." });
    }

    const randomIndex = Math.floor(Math.random() * participants.length);
    const selectedParticipant = participants[randomIndex];

    // Marcar al participante como excluido y que ya participó
    const participantRef = db.collection("participants").doc(selectedParticipant.id);
    await participantRef.update({ excluded: true, hasDrawn: true });

    res.status(200).json({
      name: selectedParticipant.name,
      wishlist: selectedParticipant.wishlist || [],
    });
  } catch (error) {
    console.error("Error al realizar el sorteo:", error);
    res.status(500).json({ error: "Error al realizar el sorteo." });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
