const SECTOR_QUOTAS = [
  { sector: "Recursos Humanos", count: 5, position: "Analista RRHH" },
  { sector: "Salud Ocupacional", count: 5, position: "Profesional Salud Ocup." },
  { sector: "Seguridad Ocupacional", count: 10, position: "Tec. Seguridad" },
  { sector: "Producción", count: 20, position: "Operario" },
  { sector: "Ventas", count: 20, position: "Ejecutivo Comercial" },
  { sector: "Administración", count: 20, position: "Analista Administrativo" },
  { sector: "Comercialización", count: 20, position: "Asesor Comercial" },
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

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pad = (value) => String(value).padStart(3, "0");

const randomDateBetween = (start, end) => {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const date = new Date(startMs + Math.random() * (endMs - startMs));
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
      const isActive = Math.random() > 0.15; // ~85% activos
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

  // si faltan por redondeos, rellena hasta 100
  while (employees.length < 100) {
    const first = randomItem(FIRST_NAMES);
    const last = randomItem(LAST_NAMES);
    const fullName = `${first} ${last}`;
    const employeeId = `LEG-${pad(idCounter)}`;
    const medicalRecordId = `MED-${pad(idCounter + 200)}`;
    const hireDate = randomDateBetween(startBase, today);
    const isActive = Math.random() > 0.15;
    const terminationDate = isActive
      ? null
      : randomDateBetween(new Date(hireDate), today);
    employees.push({
      employeeId,
      medicalRecordId,
      fullName,
      sector: "Comercialización",
      position: "Asesor Comercial",
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

  return employees.slice(0, 100);
};

export const mockEmployees = buildEmployees();

export default mockEmployees;
