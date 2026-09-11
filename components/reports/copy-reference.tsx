"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import styles from "@/app/report/report.module.css";

export function CopyReference({ referenceNumber }: { referenceNumber: string }) {
  const [message, setMessage] = useState("");
  return (
    <>
      <Button
        type="button"
        className={styles.copyButton}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(referenceNumber);
            setMessage("Reference copied. Keep it somewhere private.");
          } catch {
            setMessage("Copy is unavailable. Select the reference above and copy it manually.");
          }
        }}
      >
        <Copy size={16} aria-hidden="true" /> Copy reference
      </Button>
      <p className={styles.copyStatus} role="status">{message}</p>
    </>
  );
}
