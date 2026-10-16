const TEXT = {
  en: "Information only, based on US FDA labels. Confirm with a pharmacist or doctor.",
  roman_urdu: "Sirf maloomat, US FDA labels par mabni. Pharmacist ya doctor se tasdeeq karein.",
};

/** FDA-label footer in the answer's language (meta.language); English when unknown. */
export default function Disclaimer({ language = "en" }) {
  return (
    <p className="mt-2 text-[11px] leading-snug text-text-secondary">{TEXT[language] ?? TEXT.en}</p>
  );
}
