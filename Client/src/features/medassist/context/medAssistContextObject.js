import { createContext } from "react";

/** Shared MedAssist state; filled by MedAssistProvider, read with useMedAssist(). */
export const MedAssistContext = createContext(null);
