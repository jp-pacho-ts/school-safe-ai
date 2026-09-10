import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localDirectory = join(root, ".local");
const dataDirectory = join(localDirectory, "postgres");
const statePath = join(localDirectory, "local-db.json");
const logPath = join(localDirectory, "postgres.log");
const envPath = join(root, ".env");
const action = process.argv[2];
const executableSuffix = process.platform === "win32" ? ".exe" : "";
const binaryNames = ["initdb", "pg_ctl", "psql", "createdb"];

function findPostgres() {
  const directories = [
    process.env.PG_BIN,
    ...(process.platform === "win32"
      ? [join(process.env.ProgramFiles ?? "C:/Program Files", "PostgreSQL", "18", "bin")]
      : []),
    ...(process.env.PATH ?? "").split(delimiter),
  ].filter(Boolean);

  const directory = directories.find((candidate) =>
    binaryNames.every((name) => existsSync(join(candidate, name + executableSuffix))),
  );

  if (!directory) {
    throw new Error(
      "PostgreSQL binaries were not found. Install PostgreSQL and set PG_BIN to its bin directory, or configure DATABASE_URL in .env and run npm run db:check.",
    );
  }

  return Object.fromEntries(
    binaryNames.map((name) => [name, join(directory, name + executableSuffix)]),
  );
}

function run(binary, args, extraEnvironment = {}, captureOutput = true) {
  return execFileSync(binary, args, {
    cwd: root,
    env: { ...process.env, ...extraEnvironment },
    encoding: "utf8",
    stdio: captureOutput ? ["ignore", "pipe", "pipe"] : "ignore",
    windowsHide: true,
    timeout: 90_000,
  });
}

function canConnect(binaries, state) {
  let serverDirectory;
  try {
    serverDirectory = run(binaries.psql, [
      "-h", state.host, "-p", String(state.port), "-U", state.user, "-w",
      "-X", "-d", "postgres", "-tA", "-v", "ON_ERROR_STOP=1",
      "-c", "SELECT current_setting('data_directory');",
    ], { PGPASSWORD: state.password, PGCONNECT_TIMEOUT: "5" }).trim();
  } catch {
    return false;
  }

  const normalize = (directory) => process.platform === "win32"
    ? resolve(directory).toLowerCase()
    : resolve(directory);
  if (normalize(serverDirectory) !== normalize(dataDirectory)) {
    throw new Error("The configured port belongs to another PostgreSQL cluster. No database changes were made.");
  }
  return true;
}

function readState() {
  let state;
  try {
    state = JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    throw new Error("Could not read .local/local-db.json. Existing files have been preserved.");
  }
  if (
    !state ||
    state.version !== 1 ||
    state.host !== "127.0.0.1" ||
    state.user !== "school_safe_ai" ||
    state.database !== "school_safe_ai" ||
    !Number.isInteger(state.port) ||
    state.port < 1024 ||
    state.port > 65535 ||
    typeof state.password !== "string" ||
    !/^[a-f0-9]{64}$/.test(state.password)
  ) {
    throw new Error("The managed database settings in .local/local-db.json are invalid. Existing files have been preserved.");
  }
  return state;
}

function isRunning(binaries) {
  try {
    run(binaries.pg_ctl, ["status", "-D", dataDirectory]);
    return true;
  } catch (error) {
    // pg_ctl returns 3 when the specified cluster is stopped.
    if (error.status === 3) return false;
    throw new Error("Could not determine the local cluster status. Check .local/postgres and the PostgreSQL binary version.");
  }
}

function start(binaries) {
  let state;
  if (existsSync(statePath)) {
    state = readState();
  } else {
    if (existsSync(envPath) || existsSync(join(root, ".env.local"))) {
      throw new Error(
        "An existing environment file is configured. Run npm run db:check to use that database. For a new managed cluster, first move your environment file to a safe backup; this helper will not replace it.",
      );
    }
    if (existsSync(dataDirectory) && readdirSync(dataDirectory).length > 0) {
      throw new Error("Existing unmanaged files were found in .local/postgres. They have been preserved; choose an existing database through .env instead.");
    }

    const port = Number(process.env.LOCAL_POSTGRES_PORT ?? 55432);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      throw new Error("LOCAL_POSTGRES_PORT must be an integer between 1024 and 65535.");
    }
    state = {
      version: 1,
      host: "127.0.0.1",
      port,
      user: "school_safe_ai",
      database: "school_safe_ai",
      password: randomBytes(32).toString("hex"),
    };
    mkdirSync(localDirectory, { recursive: true });
    writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
  }

  if (!existsSync(join(dataDirectory, "PG_VERSION"))) {
    if (existsSync(dataDirectory) && readdirSync(dataDirectory).length > 0) {
      throw new Error("The local database directory is not empty but has no PG_VERSION. Existing files were preserved; inspect the directory before retrying.");
    }
    const passwordPath = join(localDirectory, `initdb-password-${randomUUID()}.tmp`);
    let passwordFileCreated = false;
    try {
      writeFileSync(passwordPath, state.password + "\n", { flag: "wx", mode: 0o600 });
      passwordFileCreated = true;
      run(binaries.initdb, [
        "-D", dataDirectory,
        "-U", state.user,
        "--pwfile", passwordPath,
        "--auth-host=scram-sha-256",
        "--auth-local=scram-sha-256",
        "--encoding=UTF8",
        "--locale=C",
      ]);
    } catch {
      throw new Error("PostgreSQL initialization failed. Check that the binaries match your platform and the project directory is writable. Existing files were preserved.");
    } finally {
      if (passwordFileCreated && existsSync(passwordPath)) unlinkSync(passwordPath);
    }
  }

  // A sandbox may connect to PostgreSQL while lacking permission to inspect its PID.
  if (!canConnect(binaries, state) && !isRunning(binaries)) {
    try {
      // Avoid inherited output pipes keeping the synchronous child alive on Windows.
      // PostgreSQL writes diagnostics to its own log and survives this script exiting.
      run(binaries.pg_ctl, [
        "start", "-D", dataDirectory, "-l", logPath, "-w", "-t", "60",
        "-o", `-h ${state.host} -p ${state.port}`,
      ], {}, false);
    } catch {
      if (!canConnect(binaries, state)) {
        throw new Error("PostgreSQL did not start. Check .local/postgres.log for a port conflict or PostgreSQL version mismatch.");
      }
    }
  }

  const connectionArgs = ["-h", state.host, "-p", String(state.port), "-U", state.user, "-w"];
  const environment = { PGPASSWORD: state.password, PGCONNECT_TIMEOUT: "10" };
  try {
    const databaseExists = run(binaries.psql, [
      ...connectionArgs, "-X", "-d", "postgres", "-tA", "-v", "ON_ERROR_STOP=1",
      "-c", "SELECT 1 FROM pg_database WHERE datname = 'school_safe_ai';",
    ], environment).trim() === "1";
    if (!databaseExists) {
      run(binaries.createdb, [...connectionArgs, state.database], environment);
    }
  } catch {
    throw new Error("The cluster started but database setup failed. Check .local/postgres.log; the cluster and saved credentials have been preserved for a retry.");
  }

  if (!existsSync(envPath)) {
    const url = `postgresql://${state.user}:${state.password}@${state.host}:${state.port}/${state.database}?schema=public`;
    writeFileSync(envPath, `# Generated for this project's local development database.\nDATABASE_URL="${url}"\n`, {
      flag: "wx",
      mode: 0o600,
    });
    console.log("Created .env with the local database connection.");
  } else {
    console.log("Kept the existing .env unchanged. Run npm run db:check to verify its connection.");
  }
  console.log(`Local PostgreSQL is running at ${state.host}:${state.port}/${state.database}.`);
}

function stop(binaries) {
  if (!existsSync(statePath) || !existsSync(join(dataDirectory, "PG_VERSION"))) {
    console.log("No managed local PostgreSQL cluster is initialized.");
    return;
  }
  const state = readState();
  if (!isRunning(binaries)) {
    if (canConnect(binaries, state)) {
      throw new Error("PostgreSQL is running, but this process cannot inspect it. Run db:stop with the same operating-system user and permissions used to start it.");
    }
    console.log("Local PostgreSQL is already stopped.");
    return;
  }
  try {
    run(binaries.pg_ctl, ["stop", "-D", dataDirectory, "-m", "fast", "-w", "-t", "60"]);
  } catch {
    throw new Error("Could not stop the managed local cluster. Check .local/postgres.log.");
  }
  console.log("Local PostgreSQL stopped. Database files and credentials were preserved.");
}

try {
  if (action !== "start" && action !== "stop") {
    throw new Error("Usage: node scripts/local-db.mjs start|stop");
  }
  const binaries = findPostgres();
  if (action === "start") start(binaries);
  else stop(binaries);
} catch (error) {
  // Never print child-process error objects: they may contain connection details.
  console.error(error instanceof Error ? error.message : "Local PostgreSQL setup failed.");
  process.exitCode = 1;
}
