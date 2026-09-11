"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CircleCheck, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getReportFieldErrors,
  incidentTypes,
  reportInputSchema,
  type ReportFieldErrors,
  type ReportInput,
  type ValidatedReportInput,
} from "@/lib/reports/validation";
import styles from "./report-form.module.css";

type Draft = Omit<ReportInput, "incidentType" | "reporterName"> & {
  incidentType: string;
  reporterName: string;
};

type FormError = {
  message: string;
  fields?: ReportFieldErrors;
  conflict?: boolean;
};

const fieldLabels = {
  incidentType: "Incident type",
  description: "What happened",
  location: "Location",
  incidentDate: "Incident date",
  isAnonymous: "Anonymous reporting",
  reporterName: "Your name",
  submissionKey: "Form session",
} satisfies Record<keyof ReportInput, string>;

const referencePattern = /^SSA-[A-F0-9]{28}$/;
const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

function readFieldErrors(value: unknown): ReportFieldErrors {
  if (!value || typeof value !== "object") return {};
  const errors: ReportFieldErrors = {};
  for (const field of Object.keys(fieldLabels) as (keyof ReportInput)[]) {
    const message = (value as Record<string, unknown>)[field];
    if (typeof message === "string" && message.length <= 300) {
      errors[field] = message;
    }
  }
  return errors;
}

export function ReportForm({ submissionKey }: { submissionKey: string }) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    clientSnapshot,
    serverSnapshot,
  );
  const [draft, setDraft] = useState<Draft>({
    incidentType: "",
    description: "",
    location: "",
    incidentDate: "",
    isAnonymous: true,
    reporterName: "",
    submissionKey,
  });
  const [review, setReview] = useState<ValidatedReportInput | null>(null);
  const [step, setStep] = useState<"details" | "review">("details");
  const [error, setError] = useState<FormError | null>(null);
  const [pending, setPending] = useState(false);
  const [retryOnly, setRetryOnly] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const inFlight = useRef(false);
  const hasInteracted = useRef(false);
  const preserveControlFocus = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (preserveControlFocus.current) {
      preserveControlFocus.current = false;
      return;
    }
    if (error) errorSummary.current?.focus();
    else if (hasInteracted.current) heading.current?.focus();
  }, [error, step, reference]);

  function fieldDescription(field: keyof ReportInput, hint?: string) {
    return [hint, error?.fields?.[field] ? `${field}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined;
  }

  function fieldError(field: keyof ReportInput) {
    const message = error?.fields?.[field];
    return message ? (
      <p id={`${field}-error`} className={styles.fieldError}>{message}</p>
    ) : null;
  }

  function reviewDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrated || inFlight.current) return;
    hasInteracted.current = true;
    const parsed = reportInputSchema.safeParse(draft);
    if (!parsed.success) {
      setError({
        message: "Please check the following details before continuing.",
        fields: getReportFieldErrors(parsed.error),
      });
      return;
    }
    setError(null);
    setReview(parsed.data);
    setStep("review");
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!review || inFlight.current || reference || error?.conflict) return;
    hasInteracted.current = true;
    const parsed = reportInputSchema.safeParse(review);
    if (!parsed.success) {
      setRetryOnly(false);
      setStep("details");
      setError({
        message: "Please check your details again before submitting.",
        fields: getReportFieldErrors(parsed.error),
      });
      return;
    }

    inFlight.current = true;
    setPending(true);
    setError(null);
    // Once a request may have reached the server, retry its original details.
    setRetryOnly(true);
    let savedReference: string | null = null;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(parsed.data),
        signal: controller.signal,
      });
      const data: unknown = await response.json().catch(() => null);
      const payload = data && typeof data === "object"
        ? data as Record<string, unknown>
        : null;

      if (
        (response.status === 200 || response.status === 201) &&
        typeof payload?.referenceNumber === "string" &&
        referencePattern.test(payload.referenceNumber)
      ) {
        savedReference = payload.referenceNumber;
      } else if (response.status === 400) {
        setRetryOnly(false);
        setStep("details");
        setError({
          message: "Your report was not accepted. Check your details and try again.",
          fields: readFieldErrors(payload?.fieldErrors),
        });
      } else if (response.status === 409) {
        setError({
          message: "This form was already used to submit different details. Keep any reference number you received earlier. To report a separate incident, start a new form.",
          conflict: true,
        });
      } else {
        setError({
          message: "We could not confirm your submission. Your details are still here. Keep this page open and retry to confirm the same report.",
        });
      }
    } catch {
      setError({
        message: "The connection was interrupted or took too long. Your details are still here. Check your connection, then retry to confirm the same report.",
      });
    } finally {
      window.clearTimeout(timeout);
      inFlight.current = false;
      setPending(false);
    }

    if (savedReference) {
      // Retain the confirmed receipt even if the following navigation fails.
      setReference(savedReference);
      setDraft({
        incidentType: "", description: "", location: "", incidentDate: "",
        isAnonymous: true, reporterName: "", submissionKey,
      });
      setReview(null);
      try {
        router.replace("/report/success");
      } catch {
        // The success state below remains available with a normal receipt link.
      }
    }
  }

  if (reference) {
    return (
      <section className={styles.form} aria-labelledby="saved-heading">
        <div className={styles.savedIcon}><CircleCheck aria-hidden="true" /></div>
        <h2 id="saved-heading" tabIndex={-1} ref={heading}>Your report has been saved.</h2>
        <p className={styles.intro}>Keep your reference number somewhere private.</p>
        <p className={styles.reference}>{reference}</p>
        <Button asChild className={styles.primaryButton}>
          <a href="/report/success">View your receipt <ArrowRight aria-hidden="true" /></a>
        </Button>
      </section>
    );
  }

  return (
    <div className={styles.form}>
      <noscript>
        <p className={styles.notice}>
          JavaScript is needed to review and submit this form. Enable it in your
          browser, or speak with a teacher, school counselor, or another trusted adult.
        </p>
      </noscript>
      <ol className={styles.steps} aria-label="Report progress">
        <li aria-current={step === "details" ? "step" : undefined}>
          <span aria-hidden="true">{step === "review" ? <Check size={16} /> : "1"}</span>
          Your details
        </li>
        <li aria-current={step === "review" ? "step" : undefined}>
          <span aria-hidden="true">2</span> Review & submit
        </li>
      </ol>

      <h2 ref={heading} tabIndex={-1} className={styles.heading}>
        {step === "details" ? "Tell us what happened." : "Take a moment to review."}
      </h2>
      <p className={styles.intro}>
        {step === "details"
          ? "Share what you know in your own words. All fields are required unless marked optional."
          : "Check that these details are right. Your report will only be sent when you choose Submit report."}
      </p>

      {error && (
        <div className={styles.errorSummary} ref={errorSummary} tabIndex={-1} role="alert">
          <h3>{error.conflict ? "This form has already been used" : "Please check your report"}</h3>
          <p>{error.message}</p>
          {error.fields && Object.keys(error.fields).length > 0 && (
            <ul>
              {(Object.entries(error.fields) as [keyof ReportInput, string][]).map(([field, message]) => (
                <li key={field}>
                  {field === "submissionKey" ? message : (
                    <a href={`#${field}`} onClick={(event) => {
                      event.preventDefault();
                      document.getElementById(field)?.focus();
                    }}>{fieldLabels[field]}: {message}</a>
                  )}
                </li>
              ))}
            </ul>
          )}
          {error.conflict && (
            <a href="/report" className={styles.restartLink}>Start a new report</a>
          )}
        </div>
      )}

      {step === "details" ? (
        <form noValidate autoComplete="off" onSubmit={reviewDetails}>
          <fieldset disabled={!hydrated || pending} className={styles.fields}>
            <legend className={styles.srOnly}>Incident details</legend>
            <div className={styles.field}>
              <label htmlFor="incidentType">Incident type</label>
              <p id="incidentType-hint" className={styles.hint}>Choose the closest match. Select Something else if you are unsure.</p>
              <select
                id="incidentType" name="incidentType" required value={draft.incidentType}
                aria-invalid={Boolean(error?.fields?.incidentType)}
                aria-describedby={fieldDescription("incidentType", "incidentType-hint")}
                onChange={(event) => setDraft({ ...draft, incidentType: event.target.value })}
              >
                <option value="" disabled>Select an incident type</option>
                {incidentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
              {fieldError("incidentType")}
            </div>

            <div className={styles.field}>
              <label htmlFor="description">What happened?</label>
              <p id="description-hint" className={styles.hint}>Describe what you saw or experienced. Include enough detail to help someone understand (10 to 5,000 characters).</p>
              <textarea
                id="description" name="description" rows={7} required minLength={10} maxLength={5000}
                value={draft.description} aria-invalid={Boolean(error?.fields?.description)}
                aria-describedby={fieldDescription("description", "description-hint")}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
              <p className={styles.characterCount}>{draft.description.length.toLocaleString("en")} / 5,000 characters</p>
              {fieldError("description")}
            </div>

            <div className={styles.twoColumns}>
              <div className={styles.field}>
                <label htmlFor="location">Location</label>
                <p id="location-hint" className={styles.hint}>For example, the school library or an online group.</p>
                <input
                  id="location" name="location" type="text" required maxLength={200}
                  value={draft.location} aria-invalid={Boolean(error?.fields?.location)}
                  aria-describedby={fieldDescription("location", "location-hint")}
                  onChange={(event) => setDraft({ ...draft, location: event.target.value })}
                />
                {fieldError("location")}
              </div>
              <div className={styles.field}>
                <label htmlFor="incidentDate">Incident date</label>
                <p id="incidentDate-hint" className={styles.hint}>Use the date the incident happened, not a future date.</p>
                <input
                  id="incidentDate" name="incidentDate" type="date" required min="1900-01-01"
                  value={draft.incidentDate} aria-invalid={Boolean(error?.fields?.incidentDate)}
                  aria-describedby={fieldDescription("incidentDate", "incidentDate-hint")}
                  onChange={(event) => setDraft({ ...draft, incidentDate: event.target.value })}
                />
                {fieldError("incidentDate")}
              </div>
            </div>

            <div className={styles.identity}>
              <div className={styles.identityHeading}>
                <ShieldCheck size={22} aria-hidden="true" />
                <h3>Choose how to share</h3>
              </div>
              <label className={styles.checkboxLabel} htmlFor="isAnonymous">
                <input
                  id="isAnonymous" name="isAnonymous" type="checkbox" checked={draft.isAnonymous}
                  aria-invalid={Boolean(error?.fields?.isAnonymous)}
                  aria-describedby={fieldDescription("isAnonymous", "anonymous-hint")}
                  onChange={(event) => {
                    const isAnonymous = event.target.checked;
                    setDraft({ ...draft, isAnonymous, reporterName: "" });
                    if (isAnonymous && error?.fields?.reporterName) {
                      preserveControlFocus.current = true;
                      setError((current) => {
                        if (!current?.fields?.reporterName) return current;
                        const fields = { ...current.fields };
                        delete fields.reporterName;
                        return Object.keys(fields).length ? { ...current, fields } : null;
                      });
                    }
                  }}
                />
                Submit without my name
              </label>
              <p id="anonymous-hint" className={styles.hint}>
                {draft.isAnonymous
                  ? "Your name will not be attached to this report. Avoid adding details that identify you in the description or location."
                  : "Your name will be stored with this report. Include it only if you are comfortable sharing it."}
              </p>
              {fieldError("isAnonymous")}
              {!draft.isAnonymous && (
                <div className={styles.nameField}>
                  <label htmlFor="reporterName">Your name</label>
                  <input
                    id="reporterName" name="reporterName" type="text" required maxLength={100}
                    autoComplete="name" value={draft.reporterName}
                    aria-invalid={Boolean(error?.fields?.reporterName)}
                    aria-describedby={fieldDescription("reporterName")}
                    onChange={(event) => setDraft({ ...draft, reporterName: event.target.value })}
                  />
                  {fieldError("reporterName")}
                </div>
              )}
            </div>

            <div className={styles.actions}>
              <p className={styles.hint}>You can check and edit your details before sending.</p>
              <Button type="submit" className={styles.primaryButton}>
                Review report <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </fieldset>
        </form>
      ) : review && (
        <form noValidate onSubmit={submitReport} aria-busy={pending}>
          <dl className={styles.review}>
            <div><dt>Incident type</dt><dd>{incidentTypes.find((type) => type.value === review.incidentType)?.label}</dd></div>
            <div><dt>Incident date</dt><dd>{new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${review.incidentDate}T00:00:00Z`))}</dd></div>
            <div><dt>Location</dt><dd>{review.location}</dd></div>
            <div><dt>What happened</dt><dd className={styles.description}>{review.description}</dd></div>
            <div><dt>Reporting choice</dt><dd>{review.isAnonymous ? "Anonymous - no name attached" : "Name included"}</dd></div>
            {!review.isAnonymous && <div><dt>Your name</dt><dd>{review.reporterName}</dd></div>}
          </dl>
          {review.isAnonymous && (
            <p className={styles.notice}>Check that your description and location do not include details that identify you.</p>
          )}
          {retryOnly && !error?.conflict && (
            <p className={styles.hint}>Keep these details unchanged while we confirm your submission. Retrying the same report will not create another copy.</p>
          )}
          <div className={styles.actions}>
            <Button
              type="button" variant="outline" className={styles.secondaryButton}
              disabled={pending || retryOnly}
              onClick={() => { setError(null); setStep("details"); }}
            >Edit details</Button>
            <Button type="submit" className={styles.primaryButton} disabled={pending || Boolean(error?.conflict)}>
              {pending ? "Submitting..." : retryOnly ? "Retry submission" : "Submit report"}
              {!pending && <ArrowRight aria-hidden="true" />}
            </Button>
          </div>
          <p className={styles.pendingStatus} role="status">{pending ? "Submitting your report. Please keep this page open." : ""}</p>
        </form>
      )}
    </div>
  );
}
