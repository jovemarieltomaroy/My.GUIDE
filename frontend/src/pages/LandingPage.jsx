import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import Logo from "../components/Logo";
import buildingImage from "../assets/ogc-building.jpg";

const navigationItems = [
  ["Home", "home"],
  ["About", "about"],
  ["Features", "features"],
  ["How It Works", "workflow"],
  ["Privacy", "privacy"],
  ["Help", "help"],
];

const features = [
  {
    icon: "folder",
    title: "Case Management",
    description:
      "Organize student profiles, counseling cases, assessments, progress notes, intervention plans, attachments, and case histories.",
  },
  {
    icon: "sparkle",
    title: "Intervention Recommendations",
    description:
      "Generate evidence-informed recommendations using a curated knowledge base, with every suggestion subject to counselor review.",
  },
  {
    icon: "monitor",
    title: "Case Monitoring",
    description:
      "Track active cases, follow-ups, progress documentation, status changes, and records that require attention.",
  },
  {
    icon: "chart",
    title: "Counseling Analytics",
    description:
      "Understand case trends, concern categories, student distributions, counselor workloads, and institutional activity.",
  },
  {
    icon: "shield",
    title: "Privacy and Access Control",
    description:
      "Protect confidential records through authenticated access, role-based permissions, and accountable system activity.",
  },
  {
    icon: "file",
    title: "Reports and Documentation",
    description:
      "Maintain consistent case documentation and prepare organized reports for guidance counseling operations.",
  },
];

const workflowSteps = [
  {
    number: "01",
    icon: "search",
    title: "Find the student",
    description:
      "Retrieve an existing student profile or create a minimal record when immediate assistance is needed.",
  },
  {
    number: "02",
    icon: "file",
    title: "Document the case",
    description:
      "Record the intake, presenting concerns, background, assessment, and counselor observations.",
  },
  {
    number: "03",
    icon: "sparkle",
    title: "Review recommendations",
    description:
      "Generate AI-assisted suggestions and allow the counselor to accept, revise, or reject them.",
  },
  {
    number: "04",
    icon: "check",
    title: "Monitor progress",
    description:
      "Finalize the intervention plan, add progress notes, manage follow-ups, and evaluate outcomes.",
  },
];

const privacyFeatures = [
  {
    title: "Role-based access",
    description:
      "System capabilities are controlled according to the counselor’s assigned role.",
  },
  {
    title: "Confidential records",
    description:
      "Student and counseling information is not displayed on public-facing pages.",
  },
  {
    title: "Recorded activity",
    description:
      "Important case actions are recorded to support accountability and traceability.",
  },
  {
    title: "PII-conscious AI use",
    description:
      "Personally identifiable student information is excluded from prompts sent to the language model.",
  },
];

function SectionHeading({
  label,
  title,
  description,
  centered = false,
}) {
  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : ""}>
      <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-[#9A171B]">
        {label}
      </p>

      <h2 className="mt-4 text-3xl font-bold leading-tight tracking-[-0.035em] text-[#171717] sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>

      {description && (
        <p className="mt-5 text-base leading-8 text-[#66625F] sm:text-lg">
          {description}
        </p>
      )}
    </div>
  );
}

export default function LandingPage({ onLogin }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 16);
      // Match the section just below the fixed header and scroll offset.
      let currentSection = "home";
      for (const [, section] of navigationItems) {
        if (document.getElementById(section)?.getBoundingClientRect().top <= 100) {
          currentSection = section;
        }
      }
      setActiveSection(currentSection);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const scrollToSection = (sectionId) => {
    setMobileMenuOpen(false);

    if (sectionId === "home") {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }

    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#171717]">
      {/* NAVIGATION */}
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${
          hasScrolled
            ? "border-[#E9E5E2] bg-white shadow-[0_8px_30px_rgba(30,20,20,0.05)]"
            : "border-transparent bg-white"
        }`}
      >
        <div className="mx-auto flex h-[68px] max-w-[1120px] items-center justify-between px-5 sm:px-8 lg:px-10">
          <Logo onClick={() => scrollToSection("home")} />

          <nav className="hidden items-center gap-1 lg:flex">
            {navigationItems.map(([label, section]) => (
              <button
                key={section}
                type="button"
                aria-current={activeSection === section ? "location" : undefined}
                onClick={() => scrollToSection(section)}
                className="rounded-lg px-3.5 py-2.5 text-[13px] font-medium text-[#5F5B58] transition hover:bg-[#F8F4F2] hover:text-[#8C1518]"
              >
                <span className={`border-b-[3px] pb-1 ${activeSection === section ? "border-[#A30012]" : "border-transparent"}`}>
                  {label}
                </span>
              </button>
            ))}

            <button
              type="button"
              onClick={onLogin}
              className="ml-4 rounded-lg bg-[#8C1518] px-5 py-3 text-[13px] font-semibold text-white transition hover:bg-[#701013] focus:outline-none focus:ring-4 focus:ring-[#8C1518]/15"
            >
              Counselor Login
            </button>
          </nav>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((current) => !current)}
            className="grid h-10 w-10 place-items-center rounded-lg border border-[#E6E2DF] text-[#4F4B48] transition hover:bg-[#F8F6F4] lg:hidden"
            aria-label={
              mobileMenuOpen
                ? "Close navigation menu"
                : "Open navigation menu"
            }
          >
            <Icon
              name={mobileMenuOpen ? "close" : "menu"}
              className="h-5 w-5"
            />
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-[#EBE7E4] bg-white px-5 py-4 shadow-xl lg:hidden">
            <nav className="mx-auto flex max-w-[1240px] flex-col">
              {navigationItems.map(([label, section]) => (
                <button
                  key={section}
                  type="button"
                  aria-current={activeSection === section ? "location" : undefined}
                onClick={() => scrollToSection(section)}
                  className="rounded-lg px-4 py-3 text-left text-[15px] font-medium text-[#514D4A] transition hover:bg-[#F8F5F3] hover:text-[#8C1518]"
                >
                  <span className={`border-b-[3px] pb-1 ${activeSection === section ? "border-[#A30012]" : "border-transparent"}`}>
                    {label}
                  </span>
                </button>
              ))}

              <button
                type="button"
                onClick={onLogin}
                className="mt-3 rounded-lg bg-[#8C1518] px-5 py-3.5 text-[15px] font-semibold text-white"
              >
                Counselor Login
              </button>
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* HERO */}
        <section
          id="home"
          className="relative flex min-h-[100svh] items-center border-b border-[#EAE5E0] bg-[#F8F7F4] pb-12 pt-[116px] sm:pb-16 sm:pt-[132px]"
        >
          <div className="mx-auto grid w-full max-w-[1240px] items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:px-10">
            <div className="max-w-[640px]">
              <div className="inline-flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#B7973D]" />

                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#765F29] sm:text-[12px]">
                  MSU-IIT Office of Guidance and Counseling
                </span>
              </div>

              <h1 className="mt-7 text-[2.75rem] font-bold leading-[1.04] tracking-[-0.055em] text-[#181716] sm:text-6xl lg:text-[4.25rem]">
                Guidance for
                <span className="block text-[#8C1518]">
                  every case.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-8 text-[#625E5B] sm:text-lg">
                A secure case management platform for documenting student
                cases, reviewing intervention recommendations, monitoring
                progress, and supporting informed counseling decisions.
              </p>

              <p className="mt-4 max-w-lg text-[13px] font-medium leading-6 text-[#68605B]">
                Guidance, Unified Intervention, Documentation, and Evaluation
                System
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onLogin}
                  className="group inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-lg bg-[#8C1518] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-[#701013] focus:outline-none focus:ring-4 focus:ring-[#8C1518]/15"
                >
                  Open My.GUIDE

                  <Icon
                    name="arrowRight"
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  />
                </button>

                <button
                  type="button"
                  onClick={() => scrollToSection("about")}
                  className="inline-flex min-h-[52px] items-center justify-center rounded-lg border border-[#DAD5D1] bg-white px-6 py-3.5 text-[15px] font-semibold text-[#34312F] transition hover:border-[#B5AAA4] hover:bg-[#FCFBFA]"
                >
                  Explore the System
                </button>
              </div>

              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3">
                {[
                  "Authorized access",
                  "Counselor-reviewed AI",
                  "Privacy-conscious",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 text-[13px] font-medium text-[#68635F]"
                  >
                    <Icon
                      name="check"
                      className="h-4 w-4 text-[#8C1518]"
                    />

                    {item}
                  </div>
                ))}
              </div>
            </div>

            <figure className="overflow-hidden rounded-[24px] border border-[#E4DED7] bg-white">
              <img
                src={buildingImage}
                alt="MSU-IIT Office of Guidance and Counseling building"
                className="aspect-[4/3] w-full object-cover object-center lg:aspect-[4/5]"
              />
              <figcaption className="px-6 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8C1518]">
                  A space for support
                </p>
                <p className="mt-2 text-[15px] font-medium text-[#38322E]">
                  Office of Guidance and Counseling
                </p>
                <p className="mt-1 text-[13px] text-[#77706A]">
                  Mindanao State University – Iligan Institute of Technology
                </p>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" className="scroll-mt-20 bg-white py-24 lg:py-28">
          <div className="mx-auto grid max-w-[1240px] gap-14 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-10">
            <div className="relative overflow-hidden rounded-[24px] bg-[#831519] p-7 sm:p-10">

              <Logo variant="icon" light />

              <p className="mt-8 text-[13px] font-semibold uppercase tracking-[0.2em] text-[#DFC066]">
                My.GUIDE
              </p>

              <h3 className="mt-4 max-w-md text-3xl font-semibold leading-snug tracking-[-0.035em] text-white">
                Guidance, Unified Intervention, Documentation, and Evaluation
                System
              </h3>

              <p className="mt-5 max-w-md text-[15px] leading-7 text-white/65">
                A case management and decision-support platform developed for
                the MSU-IIT Office of Guidance and Counseling.
              </p>

              <div className="mt-9 grid grid-cols-2 gap-3">
                {[
                  ["folder", "Case-centered"],
                  ["shield", "Privacy-conscious"],
                  ["sparkle", "AI-assisted"],
                  ["chart", "Data-informed"],
                ].map(([icon, label]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-[#A45053] bg-[#902B2F] p-4"
                  >
                    <Icon
                      name={icon}
                      className="h-5 w-5 text-[#DFC066]"
                    />

                    <p className="mt-3 text-[13px] font-medium text-white/85">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionHeading
                label="About My.GUIDE"
                title="One secure workspace for student counseling cases."
                description="My.GUIDE supports guidance counselors throughout the case lifecycle, from finding a student and documenting the intake to preparing interventions, recording progress, and producing institutional insights."
              />

              <p className="mt-5 text-base leading-8 text-[#66615E]">
                The system brings together structured documentation, a curated
                counseling knowledge base, LLM-assisted recommendations, and
                analytics while preserving counselor judgment and
                confidentiality.
              </p>

              <div className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {[
                  "Structured case documentation",
                  "Counselor approval required",
                  "Confidential record handling",
                  "Institutional analytics",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#F5E9E9] text-[#8C1518]">
                      <Icon name="check" className="h-3.5 w-3.5" />
                    </div>

                    <span className="text-[15px] font-medium text-[#3F3B39]">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section
          id="features"
          className="scroll-mt-20 bg-[#F8F6F4] py-24 lg:py-28"
        >
          <div className="mx-auto max-w-[1240px] px-5 sm:px-8 lg:px-10">
            <SectionHeading
              centered
              label="Core capabilities"
              title="Designed around the counselor’s workflow."
              description="Documentation, intervention planning, case monitoring, and analytics are organized into one focused workspace."
            />

            <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="group rounded-2xl border border-[#E7E2DE] bg-white p-6 transition duration-300 hover:-translate-y-1 hover:border-[#D7CBC5] hover:shadow-[0_18px_45px_rgba(50,35,30,0.07)]"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#F6EBEB] text-[#8C1518] transition group-hover:bg-[#8C1518] group-hover:text-white">
                    <Icon name={feature.icon} className="h-5 w-5" />
                  </div>

                  <h3 className="mt-5 text-base font-semibold text-[#262321]">
                    {feature.title}
                  </h3>

                  <p className="mt-3 text-[15px] leading-7 text-[#746E6A]">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* WORKFLOW */}
        <section
          id="workflow"
          className="scroll-mt-20 bg-white py-24 lg:py-28"
        >
          <div className="mx-auto max-w-[1240px] px-5 sm:px-8 lg:px-10">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <SectionHeading
                label="How it works"
                title="From intake to case evaluation."
              />

              <p className="max-w-2xl text-base leading-8 text-[#6D6763] lg:justify-self-end">
                Every stage keeps the student case organized while ensuring that
                recommendations and intervention decisions remain under
                counselor supervision.
              </p>
            </div>

            <div className="mt-14 grid gap-4 lg:grid-cols-4">
              {workflowSteps.map((step) => (
                <article
                  key={step.number}
                  className="relative rounded-2xl border border-[#E8E3E0] bg-white p-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#8C1518] text-white">
                      <Icon name={step.icon} className="h-5 w-5" />
                    </div>

                    <span className="text-2xl font-semibold text-[#E8E3E0]">
                      {step.number}
                    </span>
                  </div>

                  <h3 className="mt-7 text-base font-semibold text-[#292624]">
                    {step.title}
                  </h3>

                  <p className="mt-3 text-[15px] leading-7 text-[#746E6A]">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* PRIVACY */}
        <section
          id="privacy"
          className="scroll-mt-20 overflow-hidden bg-[#761216] py-24 text-white lg:py-28"
        >
          <div className="relative mx-auto max-w-[1240px] px-5 sm:px-8 lg:px-10">

            <div className="relative grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
              <div>
                <div className="grid h-12 w-12 place-items-center rounded-xl border border-[#A45053] bg-[#86262A]">
                  <Icon
                    name="shield"
                    className="h-6 w-6 text-[#DFC066]"
                  />
                </div>

                <h2 className="mt-7 text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
                  Confidentiality is part of the design.
                </h2>

                <p className="mt-5 max-w-lg text-base leading-8 text-white/65">
                  My.GUIDE is intended exclusively for authorized guidance
                  personnel. Access and activity are controlled to support
                  responsible handling of student counseling information.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {privacyFeatures.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-2xl border border-[#A45053] bg-[#86262A] p-5"
                  >
                    <Icon
                      name="check"
                      className="h-5 w-5 text-[#DFC066]"
                    />

                    <h3 className="mt-4 text-[17px] font-semibold text-white">
                      {item.title}
                    </h3>

                    <p className="mt-2 text-[15px] leading-6 text-white/60">
                      {item.description}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* HELP */}
        <section id="help" className="scroll-mt-20 bg-white py-24">
          <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#F5EAEA] text-[#8C1518]">
              <Icon name="help" className="h-5 w-5" />
            </div>

            <h2 className="mt-6 text-3xl font-semibold tracking-[-0.035em] text-[#252220] sm:text-4xl">
              Need help accessing My.GUIDE?
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[#716B67]">
              Accounts are created by an authorized administrator. For login,
              password, or account concerns, contact the designated My.GUIDE
              administrator at the Office of Guidance and Counseling.
            </p>

            <button
              type="button"
              onClick={onLogin}
              className="mt-8 inline-flex min-h-[50px] items-center gap-2.5 rounded-lg bg-[#8C1518] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-[#701013]"
            >
              Proceed to Login
              <Icon name="arrowRight" className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#F8F6F4] py-20">
          <div className="mx-auto max-w-[1240px] px-5 sm:px-8 lg:px-10">
            <div className="flex flex-col gap-8 rounded-[24px] bg-[#1D1918] px-7 py-10 text-white sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:px-12">
              <div>
                <p className="text-[16px] font-semibold uppercase tracking-[0.2em] text-[#D9BA60]">
                  Authorized access
                </p>

                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
                  Continue to your counselor dashboard.
                </h2>

                <p className="mt-3 text-[15px] leading-6 text-white/55">
                  Sign in using the account provided by your My.GUIDE
                  administrator.
                </p>
              </div>

              <button
                type="button"
                onClick={onLogin}
                className="inline-flex min-h-[50px] shrink-0 items-center justify-center gap-2.5 rounded-lg bg-white px-6 py-3.5 text-[15px] font-semibold text-[#8C1518] transition hover:bg-[#F7F2F0]"
              >
                Counselor Login
                <Icon name="arrowRight" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-[#171313] text-white">
        <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-14 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.5fr_0.7fr_0.7fr] lg:px-10">
          <div>
            <Logo light onClick={() => scrollToSection("home")} />

            <p className="mt-5 max-w-md text-[15px] leading-7 text-white/45">
              A secure case management and decision-support platform developed
              for the MSU-IIT Office of Guidance and Counseling.
            </p>

            <p className="mt-4 text-[13px] font-medium text-[#D8B95F]">
              AI-assisted recommendations. Counselor-reviewed decisions.
            </p>
          </div>

          <div>
            <h3 className="text-[17px] font-semibold">System</h3>

            <div className="mt-4 flex flex-col gap-3 text-[13px] text-white/45">
              <button
                type="button"
                onClick={() => scrollToSection("about")}
                className="text-left transition hover:text-white"
              >
                About My.GUIDE
              </button>

              <button
                type="button"
                onClick={() => scrollToSection("features")}
                className="text-left transition hover:text-white"
              >
                Features
              </button>

              <button
                type="button"
                onClick={() => scrollToSection("workflow")}
                className="text-left transition hover:text-white"
              >
                How It Works
              </button>

              <button
                type="button"
                onClick={onLogin}
                className="text-left transition hover:text-white"
              >
                Counselor Login
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-[17px] font-semibold">Support</h3>

            <div className="mt-4 flex flex-col gap-3 text-[13px] text-white/45">
              <button
                type="button"
                onClick={() => scrollToSection("privacy")}
                className="text-left transition hover:text-white"
              >
                Privacy and Security
              </button>

              <button
                type="button"
                onClick={() => scrollToSection("help")}
                className="text-left transition hover:text-white"
              >
                Access Help
              </button>

              <span>Authorized Use Policy</span>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.08]">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-5 py-5 text-[16px] text-white/30 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
            <p>
              © {new Date().getFullYear()} My.GUIDE. All rights reserved.
            </p>

            <p>MSU-IIT Office of Guidance and Counseling</p>
          </div>
        </div>
      </footer>
    </div>
  );
}