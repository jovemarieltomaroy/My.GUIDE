import fullLogo from "../assets/myguide-brand-logo.svg";
import iconLogo from "../assets/myguide-brand-icon.svg";

export default function Logo({ variant = "full", light = false, onClick, className = "" }) {
  const isIcon = variant === "icon";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center rounded-lg transition-opacity hover:opacity-85 focus:outline-none focus:ring-4 focus:ring-[#8C1518]/10 ${className}`}
      aria-label="Go to My.GUIDE home"
    >
      <img
        src={isIcon ? iconLogo : fullLogo}
        alt="My.GUIDE"
        className={
          isIcon ? "h-11 w-11 object-contain sm:h-12 sm:w-12" : "h-10 w-auto object-contain sm:h-11"
        }
      />

      {light && <span className="sr-only">My.GUIDE Guidance Case Management System</span>}
    </button>
  );
}
