"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

import styles from "./dashboard.module.css";

export function LogoutButton() {
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState("");

  async function logout() {
    if (isPending) return;

    setIsPending(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      if (!response.ok) throw new Error("Logout failed");
      window.location.replace("/login");
    } catch {
      setMessage("Could not sign out. Try again.");
      setIsPending(false);
    }
  }

  return (
    <div className={styles.logoutArea}>
      <button
        type="button"
        className={styles.logoutButton}
        onClick={logout}
        disabled={isPending}
      >
        <LogOut size={17} aria-hidden="true" />
        {isPending ? "Signing out..." : "Sign out"}
      </button>
      {message ? <p className={styles.logoutError} role="alert">{message}</p> : null}
    </div>
  );
}
