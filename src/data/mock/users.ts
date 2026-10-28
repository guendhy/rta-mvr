import type { User } from "@/types";
import { OFFICE_IDS } from "./offices";

const ts = "2024-02-01T08:00:00.000Z";
const id = (n: number) => `5f0e2c1a-8b7d-4e6f-9a1b-${String(n).padStart(12, "0")}`;

/** Demo accounts — all share the password "password123". Fictional people. */
export const SEED_USERS: User[] = [
  { id: id(1), firstName: "Michael", lastName: "Tamate", email: "superadmin@rta.gov.pg", password: "password123", employeeNumber: "RTA-EMP-0001", role: "super_admin", officeId: OFFICE_IDS.POM, phone: "+675 7100 0001", status: "active", createdAt: ts, updatedAt: ts },
  { id: id(2), firstName: "Joanne", lastName: "Sakias", email: "admin@rta.gov.pg", password: "password123", employeeNumber: "RTA-EMP-0014", role: "rta_admin", officeId: OFFICE_IDS.POM, phone: "+675 7100 0014", status: "active", createdAt: ts, updatedAt: ts },
  { id: id(3), firstName: "Grace", lastName: "Wari", email: "registration@rta.gov.pg", password: "password123", employeeNumber: "RTA-EMP-0102", role: "registration_officer", officeId: OFFICE_IDS.POM, phone: "+675 7100 0102", status: "active", createdAt: ts, updatedAt: ts },
  { id: id(4), firstName: "Lucas", lastName: "Kumul", email: "inspection@rta.gov.pg", password: "password123", employeeNumber: "RTA-EMP-0215", role: "inspection_officer", officeId: OFFICE_IDS.POM, phone: "+675 7100 0215", status: "active", createdAt: ts, updatedAt: ts },
  { id: id(5), firstName: "Esther", lastName: "Moi", email: "cashier@rta.gov.pg", password: "password123", employeeNumber: "RTA-EMP-0321", role: "cashier", officeId: OFFICE_IDS.POM, phone: "+675 7100 0321", status: "active", createdAt: ts, updatedAt: ts },
  { id: id(6), firstName: "Peter", lastName: "Kaupa", email: "supervisor@rta.gov.pg", password: "password123", employeeNumber: "RTA-EMP-0044", role: "supervisor", officeId: OFFICE_IDS.POM, phone: "+675 7100 0044", status: "active", createdAt: ts, updatedAt: ts },
  { id: id(7), firstName: "Thomas", lastName: "Yakam", email: "plate@rta.gov.pg", password: "password123", employeeNumber: "RTA-EMP-0408", role: "plate_officer", officeId: OFFICE_IDS.POM, phone: "+675 7100 0408", status: "active", createdAt: ts, updatedAt: ts },
  { id: id(8), firstName: "Ruth", lastName: "Aisi", email: "auditor@rta.gov.pg", password: "password123", employeeNumber: "RTA-EMP-0510", role: "auditor", officeId: OFFICE_IDS.POM, phone: "+675 7100 0510", status: "active", createdAt: ts, updatedAt: ts },
  { id: id(9), firstName: "Nathan", lastName: "Gumoi", email: "n.gumoi@rta.gov.pg", password: "password123", employeeNumber: "RTA-EMP-0611", role: "registration_officer", officeId: OFFICE_IDS.LAE, phone: "+675 7100 0611", status: "active", createdAt: ts, updatedAt: ts },
  { id: id(10), firstName: "Priscilla", lastName: "Tovue", email: "p.tovue@rta.gov.pg", password: "password123", employeeNumber: "RTA-EMP-0712", role: "cashier", officeId: OFFICE_IDS.KKP, phone: "+675 7100 0712", status: "active", createdAt: ts, updatedAt: ts },
  { id: id(11), firstName: "Albert", lastName: "Mek", email: "a.mek@rta.gov.pg", password: "password123", employeeNumber: "RTA-EMP-0813", role: "inspection_officer", officeId: OFFICE_IDS.HGN, phone: "+675 7100 0813", status: "active", createdAt: ts, updatedAt: ts },
  { id: id(12), firstName: "Wilma", lastName: "Daure", email: "w.daure@rta.gov.pg", password: "password123", employeeNumber: "RTA-EMP-0914", role: "cashier", officeId: OFFICE_IDS.MAD, phone: "+675 7100 0914", status: "disabled", createdAt: ts, updatedAt: ts },
];

export const USER_IDS = {
  superAdmin: id(1),
  admin: id(2),
  registration: id(3),
  inspection: id(4),
  cashier: id(5),
  supervisor: id(6),
  plate: id(7),
  auditor: id(8),
  laeRegistration: id(9),
  kokopoCashier: id(10),
  hagenInspection: id(11),
};
