import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  HeartHandshake,
  MessageCircle,
  NotebookPen,
  ShieldCheck,
  TriangleAlert,
  UsersRound,
} from "lucide-react";

import { SchoolIllustration } from "@/components/home/school-illustration";
import { SiteHeader } from "@/components/home/site-header";
import { Button } from "@/components/ui/button";
import styles from "@/components/home/home.module.css";

const principles = [
  {
    icon: MessageCircle,
    title: "A place to speak up",
    description: "Making it easier to share a concern, even when starting the conversation feels difficult.",
  },
  {
    icon: UsersRound,
    title: "People at the center",
    description: "Designed to help students connect with teachers who can listen and offer support.",
  },
  {
    icon: HeartHandshake,
    title: "Care beyond the report",
    description: "Aiming to make the next steps clearer, so a concern can become a conversation.",
  },
];

const steps = [
  {
    number: "01",
    icon: NotebookPen,
    title: "Share what happened",
    description: "Describe your concern, where and when it happened, and choose whether to include your name.",
  },
  {
    number: "02",
    icon: UsersRound,
    title: "Let a teacher review it",
    description: "A teacher will be able to review your report and record the steps taken to help.",
  },
  {
    number: "03",
    icon: Check,
    title: "Follow the next steps",
    description: "Use your report reference number to check its status as it moves through review.",
  },
];

export default function Home() {
  return (
    <div id="home" className={styles.page}>
      <a href="#main-content" className={styles.skipLink}>Skip to content</a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="hero-heading">
          <div>
            <p className={styles.eyebrow}><span className={styles.smallLine} /> EVERY VOICE MATTERS</p>
            <h1 id="hero-heading">Your voice.<br />A safer <em>school.</em></h1>
            <p className={styles.heroDescription}>
              Everyone deserves to feel safe at school. We’re building a simple way
              to share concerns, find support, and take the next step together.
            </p>
            <div className={styles.heroActions}>
              <Button asChild size="lg" className={styles.primaryButton}>
                <a href="#report-support">Reporting & support <ArrowUpRight aria-hidden="true" /></a>
              </Button>
              <a href="#how-it-works" className={styles.textLink}>
                See how it will work <ArrowDown size={16} aria-hidden="true" />
              </a>
            </div>
            <p className={styles.availability}>
              <span aria-hidden="true" className={styles.statusDot} />
              Online reporting is coming soon.
            </p>
          </div>
          <div className={styles.heroArt}>
            <SchoolIllustration />
            <p className={styles.artCaption}><HeartHandshake size={18} aria-hidden="true" /> A little courage. A caring community.</p>
          </div>
        </section>

        <div className={styles.supportStrip}>
          <div className={styles.container}>
            <ShieldCheck size={21} aria-hidden="true" />
            <p>Something on your mind? You don’t have to handle it alone.</p>
            <a href="#safety">Find a first step <ArrowRight size={16} aria-hidden="true" /></a>
          </div>
        </div>

        <section id="about" className={styles.section} aria-labelledby="about-heading" tabIndex={-1}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.eyebrow}>OUR PURPOSE</p>
              <h2 id="about-heading">A school where<br />speaking up feels possible.</h2>
            </div>
            <p className={styles.introDescription}>
              School Safe AI is a school safety reporting project built around a
              simple idea: asking for help should be easier. Our goal is to give
              students a clear way to raise concerns and teachers a way to follow
              through with care.
            </p>
          </div>
          <div className={styles.principles}>
            {principles.map(({ icon: Icon, title, description }) => (
              <article key={title} className={styles.principle}>
                <span className={styles.iconTile}><Icon size={24} aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className={styles.howSection} aria-labelledby="how-heading" tabIndex={-1}>
          <div className={styles.container}>
            <div className={styles.howHeading}>
              <p className={styles.eyebrow}>A CLEAR PATH FORWARD</p>
              <h2 id="how-heading">Small steps. Meaningful support.</h2>
              <p>The reporting experience we’re building, from sharing a concern to following its progress.</p>
              <span className={styles.previewLabel}>Coming soon</span>
            </div>
            <ol className={styles.steps}>
              {steps.map(({ number, icon: Icon, title, description }) => (
                <li key={number} className={styles.step}>
                  <div className={styles.stepTop}>
                    <span className={styles.stepNumber} aria-hidden="true">{number}</span>
                    <Icon size={26} strokeWidth={1.5} aria-hidden="true" />
                  </div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="safety" className={styles.section} aria-labelledby="safety-heading" tabIndex={-1}>
          <div className={styles.safetyGrid}>
            <div className={styles.safetyCopy}>
              <p className={styles.eyebrow}>SUPPORT STARTS WITH SOMEONE</p>
              <h2 id="safety-heading">You don’t need all<br />the answers to ask for help.</h2>
              <p>
                Whether it’s bullying, harassment, or something that doesn’t feel
                right, you can talk to a teacher, school counselor, or another
                trusted adult.
              </p>
              <ul className={styles.safetyList}>
                <li><Check size={18} aria-hidden="true" /> Find someone you feel comfortable talking to.</li>
                <li><Check size={18} aria-hidden="true" /> Start with what happened and how it made you feel.</li>
                <li><Check size={18} aria-hidden="true" /> Ask for help deciding what to do next.</li>
              </ul>
            </div>
            <aside className={styles.urgentCard} aria-labelledby="urgent-heading">
              <span className={styles.urgentIcon}><TriangleAlert size={25} aria-hidden="true" /></span>
              <h3 id="urgent-heading">Need help right now?</h3>
              <p>
                If you or someone else is in immediate danger, move to a safe place
                if you can and contact a nearby trusted adult or local emergency services.
              </p>
              <p className={styles.urgentNote}>
                This website does not provide emergency help and is not accepting reports yet.
              </p>
            </aside>
          </div>
        </section>

        <section id="report-support" className={styles.reportSection} aria-labelledby="report-heading" tabIndex={-1}>
          <div className={styles.reportCopy}>
            <p className={styles.eyebrow}>LET’S TAKE THE FIRST STEP</p>
            <h2 id="report-heading">You have a voice.<br />It deserves to be heard.</h2>
            <p>
              Online reporting is coming soon. For now, speak with a teacher,
              school counselor, or another trusted adult about your concern.
            </p>
            <Button asChild size="lg" className={styles.lightButton}>
              <a href="#safety">Explore support options <ArrowUpRight aria-hidden="true" /></a>
            </Button>
          </div>
          <div className={styles.reportArt} aria-hidden="true">
            <span className={styles.reportOrbit} />
            <MessageCircle strokeWidth={1} />
            <HeartHandshake className={styles.reportHeart} strokeWidth={1.4} />
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div>
            <a href="#home" className={styles.brand} aria-label="School Safe AI home">
              <span className={styles.brandIcon}><ShieldCheck aria-hidden="true" /></span>
              <span>School Safe <span className={styles.brandSuffix}>AI</span></span>
            </a>
            <p>A safer school starts with all of us.</p>
          </div>
          <nav aria-label="Footer navigation" className={styles.footerNav}>
            <a href="#about">Our purpose</a>
            <a href="#how-it-works">How it works</a>
            <a href="#safety">Safety & support</a>
          </nav>
        </div>
        <div className={styles.footerBottom}>
          <p>School Safe AI · Basic Competition Version</p>
          <p>Built with care. Growing together.</p>
        </div>
      </footer>
    </div>
  );
}
