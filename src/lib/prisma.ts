import { PrismaClient } from "@prisma/client";
import { loadAndValidateConnectorConfig } from "./connectors";

// §13.2 & §14.2 Slice 6: Fail closed at module initialization if any live connector driver is selected without its required settings
loadAndValidateConnectorConfig(process.env);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
