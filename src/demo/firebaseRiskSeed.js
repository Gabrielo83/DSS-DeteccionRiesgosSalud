import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { pathologyCategories } from "../data/pathologyCategories.js";
import { riskProfiles } from "../data/riskProfiles.js";
import { isFirebaseProvider } from "../services/appMode.js";
import { getFirebaseServices } from "../services/firebase/firebaseClient.js";
import { defaultRiskParameters } from "../utils/riskConfigStorage.js";

const isBrowser = () => typeof window !== "undefined";

const pathologySeed = pathologyCategories.map((category) => {
  const relatedProfiles = riskProfiles.filter((profile) =>
    profile.keywords.some(
      (keyword) => keyword.toLowerCase() === category.value.toLowerCase(),
    ),
  );
  const baseRisk =
    relatedProfiles.length > 0
      ? Math.max(...relatedProfiles.map((profile) => profile.score))
      : defaultRiskParameters.defaultRiskScore;
  const keywords = [
    category.value,
    category.label,
    ...relatedProfiles.flatMap((profile) => profile.keywords),
  ];
  return {
    codigo: category.value,
    nombre: category.label,
    grupo: category.value,
    factorRiesgoBase: baseRisk,
    palabrasClave: Array.from(new Set(keywords.filter(Boolean))),
    activo: true,
    origen: "catalogo-controlado-tfg",
  };
});

const riskParameterSeed = {
  configId: "global",
  puntajeDefault: defaultRiskParameters.defaultRiskScore,
  umbralMedioRiesgo: defaultRiskParameters.mediumRiskThreshold,
  umbralAltoRiesgo: defaultRiskParameters.highRiskThreshold,
  bonoAccidente: defaultRiskParameters.accidentBonus,
  diasRiesgoMedio: defaultRiskParameters.mediumDurationDays,
  bonoDiasMedio: defaultRiskParameters.mediumDurationBonus,
  diasRiesgoAlto: defaultRiskParameters.highDurationDays,
  bonoDiasAlto: defaultRiskParameters.highDurationBonus,
  recurrenciasMedia: defaultRiskParameters.mediumOccurrenceCount,
  bonoRecurrenciasMedia: defaultRiskParameters.mediumOccurrenceBonus,
  recurrenciasAlta: defaultRiskParameters.highOccurrenceCount,
  factorRecurrencia: defaultRiskParameters.highOccurrenceBonus,
  periodoEvaluacionMeses: defaultRiskParameters.reviewPeriodMonths,
  activo: true,
  origen: "parametros-controlados-tfg",
};

export const seedFirebaseRiskCatalogs = async () => {
  if (!isFirebaseProvider()) {
    throw new Error("El seed remoto requiere VITE_DATA_PROVIDER=firebase.");
  }

  const { auth, db } = getFirebaseServices();
  if (!auth.currentUser) {
    throw new Error("Inicia sesion antes de cargar catalogos en Firebase.");
  }

  const batch = writeBatch(db);
  pathologySeed.forEach((pathology) => {
    batch.set(
      doc(db, "patologias", pathology.codigo),
      {
        ...pathology,
        actualizadoEn: serverTimestamp(),
      },
      { merge: true },
    );
  });
  batch.set(
    doc(db, "parametros_riesgo", "global"),
    {
      ...riskParameterSeed,
      actualizadoEn: serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();

  return {
    ok: true,
    collections: ["patologias", "parametros_riesgo"],
    patologias: pathologySeed.length,
    parametrosRiesgo: 1,
    user: auth.currentUser.email,
  };
};

if (isBrowser()) {
  window.seedFirebaseRiskCatalogs = seedFirebaseRiskCatalogs;
}
