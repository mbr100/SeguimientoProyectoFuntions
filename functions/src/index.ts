import * as logger from "firebase-functions/logger";
import admin = require('firebase-admin');
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onDocumentUpdated, QueryDocumentSnapshot} from "firebase-functions/v2/firestore";
import {firestore} from "firebase-admin";
import DocumentData = firestore.DocumentData;
import WriteResult = firestore.WriteResult;

admin.initializeApp();

exports.crearAvisos = onSchedule("0 6 * * *", async () => {
    const tramitesQuery = admin.firestore().collection("tramites").where("estado", "==", "ACTIVO");
    const tramitesSnapshot = await tramitesQuery.get();

    tramitesSnapshot.forEach( (doc:QueryDocumentSnapshot) => {
        const fechaActual = new Date();
        const fechaDada = new Date(doc.data().fechaFinTramite);
        const diferenciaEnMilisegundos = fechaDada.getTime() - fechaActual.getTime();
        const diasRestantes = Math.ceil(diferenciaEnMilisegundos / (1000 * 60 * 60 * 24)); // Round up to handle partial days

        if (diasRestantes <= 9 && diasRestantes >= 0) {
            try {
                admin.firestore().collection("avisos").add({
                    fechaFinTrammite: doc.data().fechaFinTramite,
                    diasRestantes: diasRestantes,
                    mensaje: "El tramite " + doc.data().codigo + " está por vencerse",
                    tipo: "TRAMITE",
                    codigo: doc.data().codigo,
                    idTramite: doc.id
                });
                logger.info("Aviso creado para el tramite ", doc.data().codigo);
            } catch (error) {
                logger.error("Error al crear el aviso para el tramite ", doc.data().codigo, ":", error);
            }
        } else if (diasRestantes < 0) {
            try {
                admin.firestore().collection("avisos").add({
                    fechaFinTrammite: doc.data().fechaFinTramite,
                    diasRestantes: diasRestantes,
                    mensaje: "El tramite " + doc.data().codigo + " se ha vencido",
                    tipo: "TRAMITE",
                    codigo: doc.data().codigo,
                    idTramite: doc.id
                });
                logger.info("Aviso creado para el tramite ", doc.data().codigo);
            } catch (error) {
                logger.error("Error al crear el aviso para el tramite ", doc.data().codigo, ":", error);
            }
        }
    });
});

exports.eliminarAvisosEntregados = onSchedule("0 5 * * *", async () => {
    const tramitesQuery = admin.firestore().collection("tramites").where("estado", "==", "Entregado");
    const tramitesSnapshot = await tramitesQuery.get();
    const tramites = tramitesSnapshot.docs.map(doc => doc.data().codigo);

    const avisosQuery = admin.firestore().collection("avisos");
    const avisosSnapshot = await avisosQuery.get();
    avisosSnapshot.forEach((doc) => {
        if (tramites.includes(doc.data().codigo)) {
            doc.ref.delete().then( (r:WriteResult) => logger.log("Aviso eliminado "+r)).catch(() => logger.error("Error al eliminar el aviso"));
        }
    });
});

exports.eliminarAvisosDeTramitesEntregados = onDocumentUpdated('tramites/{tramiteId}', async (event) => {
    const newData: DocumentData = event.data!.after.data();
    const oldData: DocumentData = event.data!.before.data();
    if (newData.estado === "Entregado" && oldData.estado !== "Entregado") {
        const tramiteCodigo = newData.codigo;
        await admin.firestore().collection("avisos")
            .where("codigo", "==", tramiteCodigo).get().then( (querySnapshot) => {
                    querySnapshot.forEach((doc) => doc.ref.delete().then(_ => {
                        logger.log("Aviso eliminado")
                    }).catch(() => logger.error("Error al eliminar el aviso")));
            });

    }
});