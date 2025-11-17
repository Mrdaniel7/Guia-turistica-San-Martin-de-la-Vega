const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();
const storage = admin.storage();

const AVISOS_MAXIMOS = 5;
const AVISO_DIAS = 30;

const buildPublicUrl = (bucketName, filePath = '') => {
  const partes = filePath.split('/').map(encodeURIComponent);
  return `https://storage.googleapis.com/${bucketName}/${partes.join('/')}`;
};

const analizarImagenModeracion = async (file) => {
  try {
    await file.getSignedUrl({ action: 'read', expires: Date.now() + 5 * 60 * 1000 });
  } catch (error) {
    functions.logger.warn('No se pudo generar URL firmada para moderación automática', error);
  }
  functions.logger.info('Moderación pendiente - integrar API externa si es necesario');
  return { aprobada: true, detalles: 'Filtro de respaldo en backend (aprobada por defecto)' };
};

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
    estado: 'activo'
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
        baneadoDesde: ahora
      },
      { merge: true }
    );
  }
};

const registrarIpBaneada = async (ip) => {
  if (!ip) return;
  const docId = ip.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 120);
  await firestore.collection('ipsBaneadas').doc(docId).set(
    {
      ip,
      baneadaDesde: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );
};

exports.moderarImagenesResenas = functions.storage.object().onFinalize(async (object) => {
  const filePath = object.name || '';
  if (!filePath.startsWith('resenas/')) {
    return null;
  }
  const partes = filePath.split('/');
  const resenaId = partes[1];
  if (!resenaId) {
    functions.logger.warn('No se pudo determinar la reseña asociada a la imagen', filePath);
    return null;
  }

  const bucket = storage.bucket(object.bucket);
  const file = bucket.file(filePath);
  const resenaRef = firestore.collection('resenas').doc(resenaId);
  const resenaSnap = await resenaRef.get();
  if (!resenaSnap.exists) {
    functions.logger.warn('Reseña inexistente para imagen subida, se borra archivo', filePath);
    await file.delete({ ignoreNotFound: true });
    return null;
  }
  const resenaData = resenaSnap.data() || {};

  if (resenaData.usuarioId) {
    try {
      const usuarioSnap = await firestore.collection('usuarios').doc(resenaData.usuarioId).get();
      const datosUsuario = usuarioSnap.exists ? usuarioSnap.data() || {} : {};
      if (datosUsuario.baneado) {
        functions.logger.warn('Imagen bloqueada por cuenta baneada', { resenaId, usuarioId: resenaData.usuarioId });
        await file.delete({ ignoreNotFound: true });
        await resenaRef.set(
          {
            estado: 'rechazada',
            motivoRechazo: 'Cuenta baneada. Esta reseña no se publicará.',
            visibleParaAutor: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
        return null;
      }
    } catch (error) {
      functions.logger.error('No se pudo verificar el estado de baneo del usuario', error);
    }
  }

  const moderacion = await analizarImagenModeracion(file);
  if (!moderacion.aprobada) {
    await file.delete({ ignoreNotFound: true });
    await resenaRef.set(
      {
        estado: 'rechazada',
        motivoRechazo: 'imagen_inapropiada',
        actualizado: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    await crearAvisoPorImagen({ usuarioId: resenaData.usuarioId, resenaId });
    if (resenaData.ipCreacion) {
      await registrarIpBaneada(resenaData.ipCreacion);
    }
    return null;
  }

  const publicUrl = buildPublicUrl(bucket.name, filePath);
  const imagenesProcesadas = Array.isArray(resenaData.imagenesProcesadas)
    ? [...resenaData.imagenesProcesadas]
    : [];
  imagenesProcesadas.push({
    url: publicUrl,
    path: filePath,
    moderacion: moderacion.detalles || null,
    procesadaEn: admin.firestore.FieldValue.serverTimestamp()
  });
  const totalEsperado = Number(resenaData.numImagenes || resenaData.totalImagenes) || 1;

  await resenaRef.set(
    {
      imagenesProcesadas,
      estado: imagenesProcesadas.length >= totalEsperado ? 'aprobada' : 'pendiente_revision',
      imagenes: imagenesProcesadas.map((img) => img.url)
    },
    { merge: true }
  );

  if (imagenesProcesadas.length >= totalEsperado) {
    functions.logger.info(`Reseña ${resenaId} aprobada automáticamente tras moderación.`);
  }

  return null;
});
