"use client";

import { useRef, useState } from "react";
import { ArrowUpRight, Menu, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import styles from "./home.module.css";

const navigation = [
  { href: "#about", label: "Our purpose" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#safety", label: "Safety & support" },
];

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  return (
    <header
      className={styles.header}
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) {
          setIsOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <div className={styles.headerInner}>
        <a href="#home" className={styles.brand} aria-label="School Safe AI home">
          <span className={styles.brandIcon}><ShieldCheck aria-hidden="true" /></span>
          <span>School Safe <span className={styles.brandSuffix}>AI</span></span>
        </a>
        <nav className={styles.desktopNav} aria-label="Main navigation">
          {navigation.map((item) => (
            <a key={item.href} href={item.href}>{item.label}</a>
          ))}
        </nav>
        <Button asChild className={styles.headerCta}>
          <a href="#report-support">Reporting & support <ArrowUpRight aria-hidden="true" /></a>
        </Button>
        <button
          ref={menuButton}
          type="button"
          className={styles.menuToggle}
          aria-expanded={isOpen}
          aria-controls="mobile-navigation"
          aria-label={isOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
      <nav
        id="mobile-navigation"
        className={styles.mobileNav}
        aria-label="Mobile navigation"
        hidden={!isOpen}
      >
        {navigation.map((item) => (
          <a key={item.href} href={item.href} onClick={() => setIsOpen(false)}>
            {item.label}
          </a>
        ))}
        <a href="#report-support" onClick={() => setIsOpen(false)}>
          Reporting & support <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </nav>
    </header>
  );
}
