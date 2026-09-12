"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Circle, Clock3, Search, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  dismissedStatusFlow,
  getStatusLookupFieldError,
  publicStatusReportSchema,
  standardStatusFlow,
  statusDetails,
  statusLookupInputSchema,
  type PublicStatusReport,
} from "@/lib/reports/status-validation";
import styles from "./status-lookup.module.css";

type LookupState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "error"; message: string; fieldError?: string }
  | { kind: "success"; report: PublicStatusReport };

const DEMO_REFERENCE = "DEMO-UNDER-REVIEW-001";

function safeMessage(value: unknown, fallback: string) {
  return typeof value === "string" && value.length <= 300 ? value : fallback;
}

function readFieldError(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const message = (value as Record<string, unknown>).referenceNumber;
  return typeof message === "string" && message.length <= 300 ? message : undefined;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function StatusTimeline({ report }: { report: PublicStatusReport }) {
  const flow = report.currentStatus === "DISMISSED"
    ? dismissedStatusFlow
    : standardStatusFlow;
  const occurred = new Set(report.history.map((entry) => entry.status));
  const latest = report.history.at(-1);

  return (
    <section className={styles.result} aria-labelledby="status-result-heading">
      <div className={styles.resultHeader}>
        <span className={styles.resultIcon}><ShieldCheck aria-hidden="true" /></span>
        <div>
          <p className={styles.resultEyebrow}>CURRENT STATUS</p>
          <h2 id="status-result-heading" tabIndex={-1}>
            {statusDetails[report.currentStatus].label}
          </h2>
          <p>{statusDetails[report.currentStatus].description}</p>
        </div>
      </div>

      <dl className={styles.summary}>
        <div>
          <dt>Report reference</dt>
          <dd><code>{report.referenceNumber}</code></dd>
        </div>
        {latest ? (
          <div>
            <dt>Last status update</dt>
            <dd><time dateTime={latest.changedAt}>{formatDate(latest.changedAt)}</time></dd>
          </div>
        ) : null}
      </dl>

      <div className={styles.timelineSection}>
        <h3>Status timeline</h3>
        <p>Completed steps are based on the updates saved with this report.</p>
        <ol className={styles.progress}>
          {flow.map((status, index) => {
            const isCurrent = status === report.currentStatus;
            const isComplete = occurred.has(status);
            const connectorIsComplete = occurred.has(flow[index + 1]);
            return (
              <li
                key={status}
                className={`${isComplete ? styles.progressComplete : styles.progressUpcoming} ${connectorIsComplete ? styles.progressReached : ""}`}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span className={styles.progressMarker} aria-hidden="true">
                  {isComplete ? <Check /> : <Circle />}
                </span>
                <span>
                  <strong>{statusDetails[status].label}</strong>
                  <small>{isCurrent ? "Current status" : isComplete ? "Completed" : "Upcoming"}</small>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className={styles.historySection}>
        <h3>Status history</h3>
        {report.history.length ? (
          <ol className={styles.history}>
            {report.history.map((entry, index) => (
              <li key={`${entry.status}-${entry.changedAt}-${index}`}>
                <Clock3 aria-hidden="true" />
                <div>
                  <strong>{statusDetails[entry.status].label}</strong>
                  <time dateTime={entry.changedAt}>{formatDate(entry.changedAt)}</time>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.emptyHistory}>No status events are available yet.</p>
        )}
        <p className={styles.privacyNote}>
          For privacy, this page does not show incident details, names, staff notes,
          or who reviewed the report.
        </p>
      </div>
    </section>
  );
}

export function StatusLookup() {
  const [referenceNumber, setReferenceNumber] = useState("");
  const [state, setState] = useState<LookupState>({ kind: "idle" });
  const inFlight = useRef(false);
  const errorSummary = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.kind === "error") errorSummary.current?.focus();
    if (state.kind === "success") {
      document.getElementById("status-result-heading")?.focus();
    }
  }, [state]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    const parsed = statusLookupInputSchema.safeParse({ referenceNumber });
    if (!parsed.success) {
      setState({
        kind: "error",
        message: "Check the reference number and try again.",
        fieldError: getStatusLookupFieldError(parsed.error),
      });
      return;
    }

    inFlight.current = true;
    setState({ kind: "pending" });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch("/api/reports/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => null);

      if (response.ok) {
        const report = publicStatusReportSchema.safeParse(payload);
        if (!report.success) {
          setState({
            kind: "error",
            message: "We couldn't read the status response. Please try again.",
          });
          return;
        }
        setReferenceNumber(report.data.referenceNumber);
        setState({ kind: "success", report: report.data });
        return;
      }

      const body = payload && typeof payload === "object"
        ? payload as Record<string, unknown>
        : {};
      setState({
        kind: "error",
        message: safeMessage(body.message, "We couldn't check that report. Please try again."),
        fieldError: readFieldError(body.fieldErrors),
      });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof DOMException && error.name === "AbortError"
          ? "The status check took too long. Please try again."
          : "We couldn't connect to the status service. Check your connection and try again.",
      });
    } finally {
      window.clearTimeout(timeout);
      inFlight.current = false;
    }
  }

  function updateReference(value: string) {
    setReferenceNumber(value);
    if (state.kind !== "pending") setState({ kind: "idle" });
  }

  return (
    <div className={styles.lookup}>
      <form className={styles.lookupForm} onSubmit={submit} noValidate>
        <div className={styles.formHeading}>
          <span className={styles.searchIcon}><Search aria-hidden="true" /></span>
          <div>
            <h2>Enter your report reference</h2>
            <p>The reference begins with <code>SSA-</code> and appears on your receipt.</p>
          </div>
        </div>

        {state.kind === "error" ? (
          <div
            ref={errorSummary}
            className={styles.errorSummary}
            role="alert"
            tabIndex={-1}
          >
            <strong>We couldn&apos;t check the status.</strong>
            <p>{state.message}</p>
          </div>
        ) : null}

        <div className={styles.field}>
          <label htmlFor="reference-number">Reference number</label>
          <p id="reference-hint" className={styles.hint}>
            Keep this number private. Anyone with it can see the report&apos;s status.
          </p>
          <div className={styles.inputRow}>
            <input
              id="reference-number"
              name="referenceNumber"
              value={referenceNumber}
              onChange={(event) => updateReference(event.target.value)}
              aria-describedby={`reference-hint${state.kind === "error" && state.fieldError ? " reference-error" : ""}`}
              aria-invalid={state.kind === "error" && !!state.fieldError}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={40}
              disabled={state.kind === "pending"}
              placeholder="SSA-..."
            />
            <Button
              type="submit"
              className={styles.submitButton}
              disabled={state.kind === "pending"}
            >
              <Search aria-hidden="true" />
              {state.kind === "pending" ? "Checking…" : "Check status"}
            </Button>
          </div>
          {state.kind === "error" && state.fieldError ? (
            <p id="reference-error" className={styles.fieldError}>{state.fieldError}</p>
          ) : null}
          <p className={styles.pendingStatus} role="status">
            {state.kind === "pending" ? "Checking the saved status. Please wait." : ""}
          </p>
        </div>

        <div className={styles.demoReference}>
          <span>Trying the competition demo?</span>
          <button
            type="button"
            onClick={() => updateReference(DEMO_REFERENCE)}
            disabled={state.kind === "pending"}
          >
            Use <code>{DEMO_REFERENCE}</code>
          </button>
        </div>
      </form>

      {state.kind === "success" ? <StatusTimeline report={state.report} /> : null}
    </div>
  );
}
