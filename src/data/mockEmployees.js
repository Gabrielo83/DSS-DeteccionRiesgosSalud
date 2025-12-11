// Distribucion fija de 80 empleados (suma 80)
const SECTOR_QUOTAS = [
  { sector: "Recursos Humanos", count: 5, position: "Analista RRHH" },
  { sector: "Salud Ocupacional", count: 5, position: "Profesional Salud Ocup." },
  { sector: "Seguridad Ocupacional", count: 8, position: "Tec. Seguridad" },
  { sector: "Producción", count: 16, position: "Operario" },
  { sector: "Ventas", count: 16, position: "Ejecutivo Comercial" },
  { sector: "Administración", count: 15, position: "Analista Administrativo" },
  { sector: "Comercialización", count: 15, position: "Asesor Comercial" },
];

const FIRST_NAMES = [
  "Juan", "María", "Pedro", "Lucía", "Sofía", "Diego", "Camila", "Bruno",
  "Valentina", "Mateo", "Agustina", "Joaquín", "Julieta", "Nicolás", "Micaela",
  "Ramiro", "Pilar", "Hernán", "Magdalena", "Inés", "Elena", "Federico",
  "Olivia", "Hugo", "Rocío", "Mateo", "Isabela", "Quintín", "Tamara", "Romina",
  "Gabriel", "Florencia", "Lautaro", "Milagros", "Santiago", "Ana", "Carolina",
  "Franco", "Marcos", "Paula", "Ariel", "Sabrina", "Leandro", "Mauro", "Delfina",
  "Catalina", "Emilia", "Tomás", "Martina", "Renata", "Nahuel", "Axel", "Mariano",
];

const LAST_NAMES = [
  "Torres", "Vega", "Dominguez", "Navarro", "Fernandez", "Mendez", "Salazar",
  "Ruiz", "Ortega", "Villalba", "Pereyra", "Ybarra", "Toscano", "Villarroel",
  "Ximenez", "Zarate", "Castillo", "Ramos", "Gomez", "Moran", "Caamaño",
  "Liborsi", "Chavez", "Sanchez", "Romero", "Alvarez", "Herrera", "Gimenez",
  "Lopez", "Acosta", "Silva", "Martinez", "Diaz", "Ponce", "Delgado", "Ojeda",
  "Arias", "Miranda", "Rivas", "Saavedra", "Ibarra", "Paz", "Cabrera", "Montoya",
  "Benitez", "Nuñez", "Flores", "Suarez", "Luna", "Villar", "Bustos",
];

const BLOOD_TYPES = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"];

// PRNG deterministico para mantener la misma "base" en cada carga
const SEED = 123456;
const mulberry32 = (seed) => {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};
const rng = mulberry32(SEED);

const randomItem = (arr) => arr[Math.floor(rng() * arr.length)];
const pad = (value) => String(value).padStart(3, "0");

const randomDateBetween = (start, end) => {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const date = new Date(startMs + rng() * (endMs - startMs));
  return date.toISOString().slice(0, 10);
};

const buildEmployees = () => {
  const employees = [];
  let idCounter = 1;
  const today = new Date();
  const startBase = new Date(today.getFullYear() - 10, 0, 1);

  SECTOR_QUOTAS.forEach(({ sector, count, position }) => {
    for (let i = 0; i < count; i += 1) {
      const first = randomItem(FIRST_NAMES);
      const last = randomItem(LAST_NAMES);
      const fullName = `${first} ${last}`;
      const employeeId = `LEG-${pad(idCounter)}`;
      const medicalRecordId = `MED-${pad(idCounter + 200)}`;
      const hireDate = randomDateBetween(startBase, today);
      const isActive = rng() > 0.15; // ~85% activos pero deterministico
      const terminationDate = isActive
        ? null
        : randomDateBetween(new Date(hireDate), today);
      employees.push({
        employeeId,
        medicalRecordId,
        fullName,
        sector,
        position,
        email: `${first.toLowerCase()}.${last.toLowerCase()}${idCounter}@empresa.com`,
        phone: `+54 9 11 4567-${String(1000 + idCounter).slice(-4)}`,
        bloodType: randomItem(BLOOD_TYPES),
        seniority: `${1 + (idCounter % 15)} anos`,
        avatar: `https://i.pravatar.cc/150?img=${(idCounter % 70) + 1}`,
        active: isActive,
        hireDate,
        terminationDate,
      });
      idCounter += 1;
    }
  });

  return employees; // exactamente 80 registros fijos
};

export const mockEmployees = buildEmployees();

export default mockEmployees;
