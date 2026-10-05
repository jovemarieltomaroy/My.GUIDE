import { useEffect } from "react";
import Icon from "./Icon";

export default function ConsentFormModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;

    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close consent form"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-modal-title"
        className="relative z-10 flex max-h-[88vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(30,20,18,0.25)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#ECE8E5] bg-[#7D1718] px-5 py-4 text-white sm:px-6">
          <div className="flex items-start gap-3">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#E3C45E]">
                MSU-IIT Office of Guidance and Counseling
              </p>

              <h2 id="consent-modal-title" className="mt-1 text-[20px] font-semibold">
                Informed Consent for Counseling Services
              </h2>

              <p className="mt-1 text-[13px] leading-4 text-white/65">
                Review the consent information before confirming the intake acknowledgements.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Close consent form"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-5">
            <ConsentSection>
              <p>Counseling is a confidential process designed to help you address your concerns, come to a better understanding of yourself, and learn effective personal and interpersonal coping strategies. It involves a relationship between you and a trained Counselor who has the desire and willingness to help you accomplish your individual goals.</p>
              <p>Counseling involves sharing sensitive, personal, and private information that may at times be distressing. During the course of counseling, there may be periods of increased anxiety or confusion. The outcome of counseling is often positive; however, the level of satisfaction for any individual is not predictable. Your counselor is available to support you throughout the counseling process.</p>
            </ConsentSection>
            <ConsentSection title="Confidentiality">
              <p>All interactions with the counseling services of the Office of Guidance and Counseling (OGC), including scheduling of or attendance at appointments, content of your sessions, progress in counseling, and your records are confidential. No record of counseling is contained in any academic, educational or job placement file. You may request in writing that the counselor releases specific information about your counseling to persons you designate.</p>
            </ConsentSection>
            <ConsentSection title="Exceptions to Confidentiality">
              <p>Under the following circumstances can only there be a breach in confidentiality:</p>
              <p>1. The counseling staff works as a team. Your counselor may consult with other counselors to provide the best possible care. These case consultation/case conferences are for professional training purposes; and do not usually include any identifiers of the client.</p>
              <p>2. If there is evidence of clear and imminent danger or harm to yourself and/or others, a Counselor is legally required to report this information to the authorities responsible for ensuring safety.</p>
              <p>3. The staff of the Office of Guidance and Counseling who learn of, or strongly suspect physical or sexual abuse or neglect of a person under 18 years of age, must report this information to local authorities for child protection services (RA 7610).</p>
              <p>4. A court order, issued by a competent judge, may require the counselor to release information contained in records and/or require a counselor to testify in court hearing.</p>
            </ConsentSection>
            <ConsentSection title="Client's Roles">
              <p>1. The client further agrees to willingly cooperate in attending scheduled/booked counseling sessions, follow-up and/or tutorial sessions, and accomplish assigned homework/s as agreed by both parties.</p>
              <p>2. The client understands that as he/she seeks professional help, the counseling relationship established shall come to a termination or closure after careful evaluation and discretion of the attending counselor. There is <strong>no fee</strong> for counseling services availed by students within the Institute.</p>
            </ConsentSection>
            <ConsentSection title="Referral to Experts">
              <p>If you are referred off campus to health, mental health, or substance abuse professionals, you are responsible for their charges, except when referred to clinicians who have memorandum of understanding/MOU with the Institute.</p>
            </ConsentSection>
            <ConsentSection title="Consent Acknowledgment">
              <p>I have read and discussed the above information with my Counselor. I understand the risks and benefits of counseling, the nature and limits of confidentiality, and what is expected of me as a client of the Counseling Services.</p>
            </ConsentSection>
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-[#ECE8E5] bg-[#FAF9F8] px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-[13px] leading-4 text-[#8D8580]">
            Closing this window returns you to your form without clearing entered information.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-[#8C1518] px-4 font-semibold text-white hover:bg-[#701013]"
            style={{ fontSize: "15px" }}
          >
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}

function ConsentSection({ title, children }) {
  return (
    <section>
      {title && <h3 className="text-[17px] font-semibold text-[#393431]">{title}</h3>}
      <div className="mt-1.5 space-y-2 text-justify text-[14px] leading-5 text-[#6F6864]">
        {children}
      </div>
    </section>
  );
}
