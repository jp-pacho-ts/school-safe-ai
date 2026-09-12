// tsx asks Node for the current OS user while choosing a temporary directory.
// Some sandboxed Windows/Node 26 environments cannot provide that value. A
// process-local uid keeps TypeScript scripts portable without changing app runtime.
if (typeof process.geteuid !== "function") {
  process.geteuid = () => 0;
}
