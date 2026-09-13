"use client";

import { useActionState, useId } from "react";
import { CheckCheck } from "lucide-react";

import type {
  NotificationAction,
  NotificationActionState,
} from "./dashboard-types";
import styles from "./dashboard.module.css";

const initialState: NotificationActionState = {
  outcome: "idle",
  message: "",
};

function ActionMessage({
  id,
  state,
}: {
  id: string;
  state: NotificationActionState;
}) {
  if (!state.message) return null;

  return (
    <span
      id={id}
      className={
        state.outcome === "error"
          ? styles.notificationActionError
          : styles.notificationActionMessage
      }
      role={state.outcome === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {state.message}
    </span>
  );
}

export function NotificationReadStateForm({
  notificationId,
  reportReference,
  isRead,
  action,
}: {
  notificationId: string;
  reportReference: string;
  isRead: boolean;
  action: NotificationAction;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const messageId = useId();

  return (
    <form action={formAction} className={styles.notificationActionForm}>
      <input type="hidden" name="notificationId" value={notificationId} />
      <input type="hidden" name="readState" value={isRead ? "unread" : "read"} />
      <button
        type="submit"
        className={styles.notificationReadButton}
        disabled={isPending}
        aria-label={`${isRead ? "Mark unread" : "Mark read"}: report ${reportReference}`}
        aria-describedby={state.message ? messageId : undefined}
      >
        {isPending ? "Saving..." : isRead ? "Mark unread" : "Mark read"}
      </button>
      <ActionMessage id={messageId} state={state} />
    </form>
  );
}

export function MarkAllNotificationsReadForm({
  action,
}: {
  action: NotificationAction;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const messageId = useId();

  return (
    <form action={formAction} className={styles.markAllForm}>
      <button
        type="submit"
        className={styles.markAllButton}
        disabled={isPending}
        aria-describedby={state.message ? messageId : undefined}
      >
        <CheckCheck size={17} aria-hidden="true" />
        {isPending ? "Marking as read..." : "Mark all as read"}
      </button>
      <ActionMessage id={messageId} state={state} />
    </form>
  );
}
