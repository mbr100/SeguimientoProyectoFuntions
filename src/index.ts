import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated, QueryDocumentSnapshot } from "firebase-functions/v2/firestore";
import { firestore } from "firebase-admin";
import { auth } from "firebase-functions";
import { AuthEventContext, AuthUserRecord } from "firebase-functions/lib/common/providers/identity";
import { Aviso } from "./aviso.model";

import * as logger from "firebase-functions/logger";
import admin = require('firebase-admin');
import DocumentData = firestore.DocumentData;
import WriteResult = firestore.WriteResult;
import QuerySnapshot = firestore.QuerySnapshot;

admin.initializeApp();

exports.crearAvisos = onSchedule("0 6 * * *", async () => {
    const tramitesQuery: firestore.Query<firestore.DocumentData> = admin.firestore().collection("tramites").where("estado", "==", "ACTIVO");
    const tramitesSnapshot: firestore.QuerySnapshot<firestore.DocumentData> = await tramitesQuery.get();

    tramitesSnapshot.forEach( (doc:QueryDocumentSnapshot) => {
        const fechaActual: Date = new Date();
        const fechaDada: Date = new Date(doc.data().fechaFinTramite);
        const diferenciaEnMilisegundos = fechaDada.getTime() - fechaActual.getTime();
        const diasRestantes: Number = Math.ceil(diferenciaEnMilisegundos / (1000 * 60 * 60 * 24)); // Round up to handle partial days

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
            doc.ref.delete()
                .then( (r:WriteResult) => logger.log("Aviso eliminado "+r))
                .catch(() => logger.error("Error al eliminar el aviso"));
        }
    });
});

exports.eliminarAvisosDeTramitesEntregados = onDocumentUpdated('tramites/{tramiteId}', async (event) => {
    const newData: DocumentData = event.data!.after.data();
    const oldData: DocumentData = event.data!.before.data();
    if (newData.estado === "Entregado" && oldData.estado !== "Entregado") {
        const tramiteCodigo = newData.codigo;
        await admin.firestore().collection("avisos").where("codigo", "==", tramiteCodigo).get()
            .then((querySnapshot: QuerySnapshot<firestore.DocumentData>) => {
                querySnapshot.forEach((doc: QueryDocumentSnapshot) => doc.ref.delete()
                    .then(() => logger.log("Aviso eliminado"))
                    .catch(() => logger.error("Error al eliminar el aviso"))
                );
            });
    }
});

exports.crearNotificacionLogin = auth.user().beforeSignIn((user: AuthUserRecord, context: AuthEventContext) => {
    logger.log("Creando notificacion de login");
    const aviso: Aviso = new Aviso(user.displayName!, user.uid, user.email!,new Date(context.timestamp), context.ipAddress)
    admin.firestore().collection("login").add(aviso)
        .then(() => logger.log("Notificacion de login creada"))
        .catch(() => logger.error("Error al crear la notificacion de login"));
})