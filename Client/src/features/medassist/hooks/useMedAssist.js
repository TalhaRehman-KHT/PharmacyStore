import { useContext } from "react";
import { MedAssistContext } from "../context/medAssistContextObject.js";

export function useMedAssist() {
  const ctx = useContext(MedAssistContext);
  if (!ctx) throw new Error("useMedAssist must be used inside MedAssistProvider");
  return ctx;
}
