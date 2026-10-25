import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import Logo from "../components/Logo";
import buildingImage from "../assets/ogc-building.jpg";
import "./LandingPage.css";

const navigationItems = [
  ["Home", "home"],
  ["About", "about"],
  ["Overview", "overview"],
  ["Help", "help"],
];
const modules = [
  {
    icon: "folder",
    title: "Case Management",
    text: "Student records, counseling case details, case statuses, and related documentation.",
  },
  {
    icon: "file",
    title: "Intervention Planning",
    text: "Intervention plans and AI-assisted recommendations for counselor review and approval.",
  },
  {
    icon: "notes",
    title: "Progress Notes and Follow-ups",
    text: "Counseling progress records, case updates, and follow-up documentation.",
  },
  {
    icon: "chart",
    title: "Analytics and Reports",
    text: "Case distributions, categories of concern, counseling trends, and generated reports.",
  },
];
const questions = [
  [
    "Who can access My.GUIDE?",
    "My.GUIDE is accessible to authorized MSU-IIT Office of Guidance and Counseling personnel with active user accounts.",
  ],
  [
    "How can I obtain an account?",
    "Accounts are created and managed by authorized system administrators. Contact your designated administrator for account access.",
  ],
  [
    "What should I do if I cannot sign in?",
    "Check your account credentials and contact the system administrator if the issue continues.",
  ],
];

function GuidanceIllustration() {
  const nodes = [
    [160, 27, 18],
    [278, 55, 11],
    [279, 135, 13],
    [252, 231, 16],
    [166, 309, 15],
    [48, 281, 14],
    [32, 158, 9],
    [30, 41, 16],
  ];
  return (
    <svg
      className="landing-network"
      viewBox="0 0 320 340"
      role="img"
      aria-label="Connected guidance and counseling services"
    >
      <g fill="#702428" stroke="#702428" strokeWidth="10">
        {nodes.map(([x, y, r]) => {
          const dx = x - 160,
            dy = y - 162,
            length = Math.hypot(dx, dy);
          return (
            <g key={`${x}-${y}`}>
              <line
                x1={160 + (dx / length) * 53}
                y1={162 + (dy / length) * 53}
                x2={x - (dx / length) * (r + 9)}
                y2={y - (dy / length) * (r + 9)}
              />
              <circle cx={x} cy={y} r={r} stroke="none" />
            </g>
          );
        })}
        <circle cx="160" cy="162" r="42" stroke="none" />
      </g>
      <g fill="none" stroke="#B18377" strokeWidth="0.8">
        {[0, 60, 120].map((angle) => (
          <ellipse
            key={angle}
            cx="160"
            cy="162"
            rx="12"
            ry="26"
            transform={`rotate(${angle} 160 162)`}
          />
        ))}
      </g>
    </svg>
  );
}

export default function LandingPage({ onLogin }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    let frame;
    const updateSection = () => {
      const headerHeight = document.querySelector(".landing-header")?.offsetHeight ?? 80;
      let current = "home";
      for (const [, id] of navigationItems) {
        if (document.getElementById(id)?.getBoundingClientRect().top <= headerHeight + 24)
          current = id;
      }
      // Keep Help selected when the last section cannot reach the header.
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2)
        current = "help";
      setActiveSection(current);
    };
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateSection);
    };
    updateSection();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, []);
  const scrollToSection = (id) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  };
  return (
    <div className="landing-page">
      <a className="landing-skip" href="#main-content">
        Skip to content
      </a>
      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <Logo onClick={() => scrollToSection("home")} />
          <button
            type="button"
            className="landing-menu-toggle"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="landing-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? "close" : "menu"} />
          </button>
          <nav
            id="landing-navigation"
            aria-label="Main navigation"
            className={`landing-nav${menuOpen ? " is-open" : ""}`}
          >
            {navigationItems.map(([label, id]) => (
              <button
                type="button"
                key={id}
                aria-current={activeSection === id ? "location" : undefined}
                onClick={() => scrollToSection(id)}
              >
                <span className="landing-nav-label">{label}</span>
              </button>
            ))}
            <button type="button" className="landing-button landing-login" onClick={onLogin}>
              Login
            </button>
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <section
          id="home"
          className="landing-hero"
          style={{ "--building-image": `url("${buildingImage}")` }}
        >
          <div className="landing-container">
            <p className="landing-label">MSU-IIT Office of Guidance and Counseling</p>
            <div className="landing-hero-grid">
              <img
                className="landing-building"
                src={buildingImage}
                alt="MSU-IIT Office of Guidance and Counseling building"
              />
              <div className="landing-hero-copy">
                <h1>
                  My.<span>GUIDE</span>
                </h1>
                <p className="landing-expansion">
                  Guidance, Unified Intervention, Documentation, Evaluation System
                </p>
                <p className="landing-intro">
                  An AI-assisted case management system for managing student counseling cases,
                  documenting interventions, monitoring progress, and reviewing case information.
                </p>
                <div className="landing-actions">
                  <button
                    type="button"
                    className="landing-button landing-button-outline"
                    onClick={() => scrollToSection("about")}
                  >
                    About the System
                  </button>
                  <button type="button" className="landing-button" onClick={onLogin}>
                    Open My.GUIDE <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="about" className="landing-about landing-section">
          <div className="landing-container">
            <p className="landing-label">About My.GUIDE</p>
            <div className="landing-about-grid">
              <div>
                <h2>
                  A Centralized Approach to
                  <br className="landing-desktop-break" /> Guidance Case Management
                </h2>
                <div className="landing-about-text">
                  <p>
                    My.GUIDE (Guidance, Unified Intervention, Documentation, and Evaluation System)
                    is an AI-assisted case management system developed for the MSU-IIT Office of
                    Guidance and Counseling.
                  </p>
                  <p>
                    The system provides a central platform where counselors can manage student
                    counseling cases, organize records, prepare intervention plans, and track case
                    progress. It also uses AI to suggest possible interventions based on available
                    guidance and counseling resources.
                  </p>
                  <p>
                    These suggestions are meant to assist counselors in planning appropriate
                    interventions. All recommendations are reviewed and approved by counselors
                    before they are used.
                  </p>
                </div>
              </div>
              <GuidanceIllustration />
            </div>
          </div>
        </section>
        <section id="overview" className="landing-overview landing-section">
          <div className="landing-container">
            <p className="landing-label">System Overview</p>
            <h2>System Modules</h2>
            <p className="landing-section-intro">
              The following modules are available to authorized users according to their assigned
              roles and access permissions.
            </p>
            <div className="landing-module-grid">
              {modules.map((module) => (
                <article key={module.title} className="landing-card">
                  <h3>
                    <Icon name={module.icon} />
                    {module.title}
                  </h3>
                  <p>{module.text}</p>
                </article>
              ))}
              <article className="landing-card landing-access">
                <h3>
                  <Icon name="shield" />
                  System Access
                </h3>
                <p>
                  My.GUIDE is intended for authorized personnel of the MSU-IIT Office of Guidance
                  and Counseling.
                </p>
                <p>
                  Users are required to sign in using their assigned credentials. Access to system
                  records and functions is determined by their assigned roles and permissions.
                </p>
              </article>
              <div className="landing-access-notice">
                <Icon name="help" />
                <p>
                  For account creation, access concerns, or account-related assistance, please
                  contact the designated system administrator.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section id="help" className="landing-help landing-section">
          <div className="landing-container">
            <p className="landing-label">Help and Support</p>
            <h2>How Can We Help?</h2>
            <p className="landing-section-intro">
              For questions about accessing or using My.GUIDE, refer to the information below or
              contact the designated system administrator.
            </p>
            <div className="landing-questions">
              {questions.map(([question, answer]) => (
                <article className="landing-question" key={question}>
                  <h3>{question}</h3>
                  <p>{answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <Logo onClick={() => scrollToSection("home")} />
        <p>Guidance, Unified Intervention, Documentation, Evaluation System</p>
        <p>© 2026 My.GUIDE. For authorized institutional use.</p>
      </footer>
    </div>
  );
}
