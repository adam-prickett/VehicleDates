interface RegistrationPlateProps {
  registration: string;
  size?: "sm" | "md" | "lg";
}

function formatUKReg(raw: string): string {
  const r = raw.replace(/\s+/g, "").toUpperCase();

  // Current format (2001–present): AB12CDE → AB12 CDE
  if (/^[A-Z]{2}[0-9]{2}[A-Z]{3}$/.test(r)) {
    return `${r.slice(0, 4)} ${r.slice(4)}`;
  }

  // Prefix format (1983–2001): A123BCD → A123 BCD
  if (/^[A-Z][0-9]{1,3}[A-Z]{3}$/.test(r)) {
    return `${r.slice(0, -3)} ${r.slice(-3)}`;
  }

  // Suffix format (1963–1983): ABC123D → ABC 123D
  if (/^[A-Z]{3}[0-9]{1,3}[A-Z]$/.test(r)) {
    return `${r.slice(0, 3)} ${r.slice(3)}`;
  }

  // Northern Ireland: AZ1234 → AZ 1234
  if (/^[A-Z]{2}[0-9]{3,4}$/.test(r)) {
    return `${r.slice(0, 2)} ${r.slice(2)}`;
  }

  // Dateless (3+1–4 digits): ABC1 / ABC12 / ABC123 / ABC1234
  if (/^[A-Z]{3}[0-9]{1,4}$/.test(r)) {
    return `${r.slice(0, 3)} ${r.slice(3)}`;
  }

  // Dateless (1–4 digits + 3 letters): 1ABC / 12ABC / 123ABC / 1234ABC
  if (/^[0-9]{1,4}[A-Z]{3}$/.test(r)) {
    return `${r.slice(0, -3)} ${r.slice(-3)}`;
  }

  return r;
}

export function RegistrationPlate({
  registration,
  size = "md",
}: RegistrationPlateProps) {
  const sizeClasses = {
    sm: "text-xl px-3 py-1 rounded",
    md: "text-3xl px-4 py-1.5 rounded-md",
    lg: "text-4xl px-5 py-2 rounded-lg",
  };

  return (
    <div
      className={`inline-flex items-center justify-center font-black tracking-wide bg-amber-300 text-gray-900 border-2 border-gray-800 ${sizeClasses[size]}`}
      style={{ fontFamily: "'UKNumberPlate', 'Charles Wright', 'Arial Black', sans-serif" }}
    >
      {formatUKReg(registration)}
    </div>
  );
}
