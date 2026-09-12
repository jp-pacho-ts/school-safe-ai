"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import styles from "./login.module.css";

type DemoCredentials = {
  email: string;
  accessCode: string;
};

type LoginState =
  | { kind: "idle" }
  | { kind: "pending" }
  | {
      kind: "error";
      message: string;
      fieldErrors?: { email?: string; accessCode?: string };
    };

function safeMessage(value: unknown, fallback: string) {
  return typeof value === "string" && value.length <= 300 ? value : fallback;
}

function safeFieldErrors(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  return {
    email: typeof raw.email === "string" && raw.email.length <= 300
      ? raw.email
      : undefined,
    accessCode: typeof raw.accessCode === "string" && raw.accessCode.length <= 300
      ? raw.accessCode
      : undefined,
  };
}

export function LoginForm({ demoCredentials }: { demoCredentials: DemoCredentials | null }) {
  const router = useRouter();
  const [state, setState] = useState<LoginState>({ kind: "idle" });
  const errorSummary = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (state.kind === "error") errorSummary.current?.focus();
  }, [state]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    const form = new FormData(event.currentTarget);
    const email = form.get("email");
    const accessCode = form.get("accessCode");
    inFlight.current = true;
    setState({ kind: "pending" });

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, accessCode }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (response.ok) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      const result = payload && typeof payload === "object"
        ? payload as Record<string, unknown>
        : {};
      setState({
        kind: "error",
        message: safeMessage(
          result.message,
          "We couldn\u2019t sign you in. Check your staff details and try again.",
        ),
        fieldErrors: safeFieldErrors(result.fieldErrors),
      });
    } catch {
      setState({
        kind: "error",
        message: "We couldn\u2019t connect to staff sign-in. Check your connection and try again.",
      });
    } finally {
      inFlight.current = false;
    }
  }

  const emailError = state.kind === "error" ? state.fieldErrors?.email : undefined;
  const accessCodeError = state.kind === "error"
    ? state.fieldErrors?.accessCode
    : undefined;

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {demoCredentials ? (
        <aside className={styles.demoCredentials} aria-label="Local demo sign-in details">
          <strong>Local competition demo</strong>
          <span>Email: <code>{demoCredentials.email}</code></span>
          <span>Access code: <code>{demoCredentials.accessCode}</code></span>
        </aside>
      ) : null}

      {state.kind === "error" ? (
        <div ref={errorSummary} className={styles.error} role="alert" tabIndex={-1}>
          <strong>We couldn&apos;t sign you in.</strong>
          <p>{state.message}</p>
        </div>
      ) : null}

      <div className={styles.field}>
        <label htmlFor="staff-email">Staff email</label>
        <input
          id="staff-email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          maxLength={254}
          defaultValue={demoCredentials?.email}
          required
          disabled={state.kind === "pending"}
          aria-invalid={!!emailError}
          aria-describedby={emailError ? "staff-email-error" : undefined}
        />
        {emailError ? <p id="staff-email-error" className={styles.fieldError}>{emailError}</p> : null}
      </div>

      <div className={styles.field}>
        <label htmlFor="staff-access-code">Staff access code</label>
        <input
          id="staff-access-code"
          name="accessCode"
          type="password"
          autoComplete="current-password"
          maxLength={512}
          required
          disabled={state.kind === "pending"}
          aria-invalid={!!accessCodeError}
          aria-describedby="access-code-hint"
        />
        <p id="access-code-hint" className={accessCodeError ? styles.fieldError : styles.hint}>
          {accessCodeError ?? "Use the access code provided by the competition demo administrator."}
        </p>
      </div>

      <Button className={styles.submit} type="submit" disabled={state.kind === "pending"}>
        <LogIn aria-hidden="true" />
        {state.kind === "pending" ? "Signing in\u2026" : "Sign in"}
      </Button>
      <p className={styles.pending} role="status">
        {state.kind === "pending" ? "Checking your staff access. Please wait." : ""}
      </p>
    </form>
  );
}
