import { loadEnvConfig } from "@next/env";

import { seedDemoData } from "./seed-data";

async function main() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

  if (process.env.NODE_ENV === "production") {
    console.error("Fictional demo seeding is disabled when NODE_ENV=production.");
    process.exitCode = 1;
    return;
  }

  const { prisma } = await import("../lib/prisma");

  try {
    await prisma.$transaction((tx) => seedDemoData(tx), {
      maxWait: 10_000,
      timeout: 30_000,
    });
    console.log("Fictional demo fixtures are ready; existing records were preserved.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error(
    "Demo seeding failed. Check the development database configuration and apply migrations before retrying.",
  );
  process.exitCode = 1;
});
