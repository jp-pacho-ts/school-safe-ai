"use client";

import { useActionState, useEffect, useRef } from "react";
import { ArrowRight, CheckCircle2, Info } from "lucide-react";

import {
  dashboardStatusLabels,
  getAllowedDashboardStatuses,
  type DashboardReportStatus,
  type StatusUpdateAction,
  type StatusUpdateFormState,
} from "./dashboard-types";
import styles from "./dashboard.module.css";

const initialState: StatusUpdateFormState = {
  outcome: "idle",
  message: "",
};

export function StatusUpdateForm({
  reportId,
  currentStatus,
  action,
}: {
  reportId: string;
  currentStatus: DashboardReportStatus;
  action: StatusUpdateAction;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const allowedStatuses = getAllowedDashboardStatuses(currentStatus);

  useEffect(() => {
    if (state.outcome === "success") formRef.current?.reset();
  }, [state]);

  if (allowedStatuses.length === 0) {
    return (
      <div className={styles.terminalStatus}>
        <CheckCircle2 size={21} aria-hidden="true" />
        <div>
          <h3>Review complete</h3>
          <p>This report is in a final status and has no available next step.</p>
        </div>
      </div>
    );
  }

  const statusError = state.fieldErrors?.status;
  const noteError = state.fieldErrors?.note;
  const formError = state.fieldErrors?.form;

  return (
    <form ref={formRef} action={formAction} className={styles.statusForm}>
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="currentStatus" value={currentStatus} />

      <label className={styles.formField}>
        <span>Move report to</span>
        <select
          name="status"
          required
          defaultValue=""
          disabled={isPending}
          aria-invalid={statusError ? true : undefined}
          aria-describedby={statusError ? "status-update-error" : undefined}
        >
          <option value="" disabled>Choose the next status</option>
          {allowedStatuses.map((status) => (
            <option key={status} value={status}>{dashboardStatusLabels[status]}</option>
          ))}
        </select>
        {statusError ? <span id="status-update-error" className={styles.fieldError}>{statusError}</span> : null}
      </label>

      <label className={styles.formField}>
        <span>Internal status note <small>Optional</small></span>
        <textarea
          name="note"
          rows={5}
          maxLength={2000}
          disabled={isPending}
          placeholder="Record the review step or follow-up for other authorized staff."
          aria-invalid={noteError ? true : undefined}
          aria-describedby={noteError ? "status-note-help status-note-error" : "status-note-help"}
        />
        <small id="status-note-help" className={styles.fieldHelp}>
          Internal notes are visible only in the staff dashboard, never in public status lookup.
        </small>
        {noteError ? <span id="status-note-error" className={styles.fieldError}>{noteError}</span> : null}
      </label>

      <div className={styles.updateNotice}>
        <Info size={17} aria-hidden="true" />
        <p>The new status will immediately appear in the student&apos;s private status lookup.</p>
      </div>

      {state.message ? (
        <p
          className={state.outcome === "success" ? styles.formSuccess : styles.formError}
          role={state.outcome === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
      {formError && formError !== state.message ? <p className={styles.formError} role="alert">{formError}</p> : null}

      <button type="submit" className={styles.updateButton} disabled={isPending}>
        {isPending ? "Saving update..." : "Save status update"}
        {!isPending ? <ArrowRight size={17} aria-hidden="true" /> : null}
      </button>
    </form>
  );
}
