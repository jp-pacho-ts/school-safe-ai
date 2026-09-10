import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
  const { prisma } = await import("../lib/prisma");

  try {
    const rows = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1::int AS ok`;

    if (rows[0]?.ok !== 1) {
      throw new Error("Unexpected database response.");
    }

    console.log("PostgreSQL connection successful (Prisma SELECT 1).");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error(
    "Database connection check failed. Verify DATABASE_URL and that PostgreSQL is running.",
  );
  process.exitCode = 1;
});