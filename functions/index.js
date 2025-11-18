const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();
const storage = admin.storage();
const bucket = storage.bucket();
const vision = require('@google-cloud/vision');
const visionClient = new vision.ImageAnnotatorClient();

const AVISOS_MAXIMOS = 5;
const AVISO_DIAS = 30;

// Construir URL pública desde bucket + path
const buildPublicUrl = (bucketName, filePath = '') => {
  const partes = filePath.split('/').map(encodeURIComponent);
  return `https://storage.googleapis.com/${bucketName}/${partes.join('/')}`;
};

// Moderación real con Cloud Vision SafeSearch
const analizarImagenModeracion = async (file) => {
  const gcsUri = `gs://${file.bucket.name}/${file.name}`;
  try {
    const [result] = await visionClient.safeSearchDetection(gcsUri);
    const deteccion = result?.safeSearchAnnotation || {};
    const niveles = ['UNKNOWN', 'VERY_UNLIKELY', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'VERY_LIKELY'];
    const evaluar = (valor) => niveles.indexOf(valor || 'UNKNOWN');
    const adult = evaluar(deteccion.adult);
    const violence = evaluar(deteccion.violence);
    const racy = evaluar(deteccion.racy);
    const medical = evaluar(deteccion.medical);
    const spoof = evaluar(deteccion.spoof);

    const bloqueado = [adult, violence, racy, medical, spoof].some((nivel) => nivel >= niveles.indexOf('LIKELY'));

    return {
      aprobada: !bloqueado,
      detalles: JSON.stringify({
        adult: deteccion.adult,
        violence: deteccion.violence,
        racy: deteccion.racy,
        medical: deteccion.medical,
        spoof: deteccion.spoof,
      }),
    };
  } catch (error) {
    functions.logger.error('[functions-moderacion] Vision SafeSearch falló', error);
    return {
      aprobada: false,
      detalles: 'Error al analizar imagen',
    };
  }
};

// Crear aviso por imagen inadecuada y, si supera umbral, banear usuario
const crearAvisoPorImagen = async ({ usuarioId, resenaId }) => {
  if (!usuarioId) return;

  const ahora = admin.firestore.Timestamp.now();
  const expiraEn = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + AVISO_DIAS * 24 * 60 * 60 * 1000)
  );

  await firestore.collection('avisos').add({
    usuarioId,
    tipo: 'imagen_inadecuada',
    motivo: 'La imagen subida en una reseña infringía las normas',
    resenaId: resenaId || null,
    fecha: ahora,
    expiraEn,
    estado: 'activo',
  });

  const avisosActivosSnap = await firestore
    .collection('avisos')
    .where('usuarioId', '==', usuarioId)
    .where('expiraEn', '>', ahora)
    .get();

  if (avisosActivosSnap.size >= AVISOS_MAXIMOS) {
    await firestore.collection('usuarios').doc(usuarioId).set(
      {
        baneado: true,
        baneadoDesde: ahora,
      },
      { merge: true }
    );
  }
};

// Registrar IP baneada (por abuso / contenido inadecuado)
const registrarIpBaneada = async (ip) => {
  if (!ip) return;

  const docId = ip.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 120);

  await firestore.collection('ipsBaneadas').doc(docId).set(
    {
      ip,
      baneadaDesde: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
};

// ============================================================================
// FUNCIÓN 1: MODERACIÓN DE IMÁGENES DE RESEÑAS
// ============================================================================

exports.moderarImagenesResenas = functions.storage
  .object()
  .onFinalize(async (object) => {
    const filePath = object.name || '';
    if (!filePath.startsWith('resenas/')) {
      // No es una imagen de reseña, ignoramos
      return null;
    }

    const partes = filePath.split('/');
    const resenaId = partes[1];

    if (!resenaId) {
      functions.logger.warn(
        'No se pudo determinar la reseña asociada a la imagen',
        filePath
      );
      return null;
    }

    const bucketInstance = storage.bucket(object.bucket);
    const file = bucketInstance.file(filePath);

    const resenaRef = firestore.collection('resenas').doc(resenaId);
    const resenaSnap = await resenaRef.get();

    if (!resenaSnap.exists) {
      functions.logger.warn(
        'Reseña inexistente para imagen subida, se borra archivo',
        filePath
      );
      await file.delete({ ignoreNotFound: true });
      return null;
    }

    const resenaData = resenaSnap.data() || {};

    // Si tenemos usuarioId, comprobar si el usuario está baneado
    if (resenaData.usuarioId) {
      try {
        const usuarioSnap = await firestore
          .collection('usuarios')
          .doc(resenaData.usuarioId)
          .get();
        const datosUsuario = usuarioSnap.exists ? usuarioSnap.data() || {} : {};

        if (datosUsuario.baneado) {
          functions.logger.warn('Imagen bloqueada por cuenta baneada', {
            resenaId,
            usuarioId: resenaData.usuarioId,
          });

          await file.delete({ ignoreNotFound: true });

          await resenaRef.set(
            {
              estado: 'rechazada',
              motivoRechazo:
                'Cuenta baneada. Esta reseña no se publicará.',
              visibleParaAutor: false,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          return null;
        }
      } catch (error) {
        functions.logger.error(
          'No se pudo verificar el estado de baneo del usuario',
          error
        );
      }
    }

    const moderacion = await analizarImagenModeracion(file);

    if (!moderacion.aprobada) {
      functions.logger.warn('[functions-moderacion] Imagen rechazada', {
        resenaId,
        motivo: moderacion.detalles,
      });
      await file.delete({ ignoreNotFound: true });

      await resenaRef.set(
        {
          estado: 'rechazada',
          motivoRechazo: 'imagen_inapropiada',
          visibleParaAutor: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await crearAvisoPorImagen({
        usuarioId: resenaData.usuarioId,
        resenaId,
      });

      if (resenaData.ipCreacion) {
        await registrarIpBaneada(resenaData.ipCreacion);
      }

      return null;
    }

    // Si la imagen se aprueba, la añadimos a la lista de procesadas
    const publicUrl = buildPublicUrl(bucketInstance.name, filePath);

    const imagenesProcesadas = Array.isArray(resenaData.imagenesProcesadas)
      ? [...resenaData.imagenesProcesadas]
      : [];

    imagenesProcesadas.push({
      url: publicUrl,
      path: filePath,
      moderacion: moderacion.detalles || null,
      procesadaEn: admin.firestore.FieldValue.serverTimestamp(),
    });

    const totalEsperado =
      Number(resenaData.numImagenes || resenaData.totalImagenes) || 1;

    const nuevoEstado =
      imagenesProcesadas.length >= totalEsperado
        ? 'aprobada'
        : 'pendiente_revision';

    await resenaRef.set(
      {
        imagenesProcesadas,
        estado: nuevoEstado,
        imagenes: imagenesProcesadas.map((img) => img.url),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    functions.logger.info('[functions-moderacion] Imagen aprobada', {
      resenaId,
      estado: nuevoEstado,
      totalProcesadas: imagenesProcesadas.length,
      totalEsperado,
      publicUrl,
    });

    return null;
  });

// ============================================================================
// FUNCIÓN 2: LIMPIEZA AUTOMÁTICA AL BANEAR USUARIO
// ============================================================================

exports.onUserBannedCleanup = functions.firestore
  .document('usuarios/{uid}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const uid = context.params.uid;

    // Solo actuamos si pasa de no baneado -> baneado
    if (!before || before.baneado === true) {
      functions.logger.info(
        `Usuario ${uid}: ya estaba baneado o sin datos previos, no se limpia.`
      );
      return null;
    }

    if (!after || after.baneado !== true) {
      functions.logger.info(
        `Usuario ${uid}: no ha pasado a baneado, no se limpia.`
      );
      return null;
    }

    functions.logger.info(
      `🚨 Usuario ${uid} ha sido baneado. Iniciando limpieza de reseñas e imágenes...`
    );

    try {
      // 1. Buscar reseñas del usuario
      const resenasSnap = await firestore
        .collection('resenas')
        .where('usuarioId', '==', uid)
        .get();

      let resenasActualizadas = 0;
      let imagenesEliminadas = 0;

      for (const doc of resenasSnap.docs) {
        const data = doc.data() || {};
        const resenaId = doc.id;

        const paths = new Set();

        // Paths desde imagenesProcesadas (path dentro de Storage)
        if (Array.isArray(data.imagenesProcesadas)) {
          for (const img of data.imagenesProcesadas) {
            if (img && typeof img.path === 'string') {
              paths.add(img.path);
            }
          }
        }

        // Paths en imagenesPendientes (si las usas como rutas)
        if (Array.isArray(data.imagenesPendientes)) {
          for (const p of data.imagenesPendientes) {
            if (typeof p === 'string') {
              paths.add(p);
            }
          }
        }

        // Por si alguna vez guardaste paths directamente en imagenes[]
        if (Array.isArray(data.imagenes)) {
          for (const value of data.imagenes) {
            if (
              typeof value === 'string' &&
              !value.startsWith('http') && // si no es URL, puede ser path
              value.includes('resenas/')
            ) {
              paths.add(value);
            }
          }
        }

        // Marcar reseña como rechazada y oculta
        await doc.ref.set(
          {
            estado: 'rechazada',
            motivoRechazo:
              'Tu cuenta ha sido baneada. Esta reseña se ha desactivado automáticamente.',
            visibleParaAutor: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        resenasActualizadas++;

        // Borrar imágenes asociadas
        for (const path of paths) {
          try {
            await bucket.file(path).delete({ ignoreNotFound: true });
            imagenesEliminadas++;
            functions.logger.info(
              `🗑️ Imagen eliminada por baneo de usuario ${uid}: ${path} (reseña ${resenaId})`
            );
          } catch (error) {
            functions.logger.error(
              `❌ Error borrando imagen ${path} de reseña ${resenaId}`,
              error
            );
          }
        }
      }

      // 2. Crear aviso de baneo
      const ahora = admin.firestore.Timestamp.now();
      const expiraEn = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + AVISO_DIAS * 24 * 60 * 60 * 1000)
      );
      const motivoBaneo =
        after.motivoBaneo ||
        'Tu cuenta ha sido baneada por incumplir las normas de la comunidad.';

      const avisoRef = await firestore.collection('avisos').add({
        usuarioId: uid,
        tipo: 'baneo_usuario',
        motivo: motivoBaneo,
        resenaId: null,
        fecha: ahora,
        expiraEn,
        estado: 'activo',
      });

      functions.logger.info(
        `✅ Limpieza por baneo completada para usuario ${uid}. ` +
          `Reseñas actualizadas: ${resenasActualizadas}, ` +
          `Imágenes eliminadas: ${imagenesEliminadas}, ` +
          `Aviso creado: ${avisoRef.id}`
      );

      return null;
    } catch (error) {
      functions.logger.error(
        `❌ Error en onUserBannedCleanup para usuario ${uid}`,
        error
      );
      throw error;
    }
  });
