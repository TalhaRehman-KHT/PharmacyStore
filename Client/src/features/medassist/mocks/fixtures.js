/**
 * Mock data for the MedAssist mock client. Only api/mockClient.js may import this file.
 * Drug facts are short, general label-style summaries for demo purposes.
 */

const FDA_URL = "https://open.fda.gov/apis/drug/label/";

/** ISO timestamp `minutes` ago. */
export function ago(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/** Drug knowledge used to build answers and citations. Keyed by generic name. */
export const DRUGS = {
  paracetamol: {
    generic: "paracetamol",
    brand: "Panadol",
    aliases: ["paracetamol", "panadol", "acetaminophen", "calpol"],
    uses: "mild to moderate pain (headache, toothache, body ache) and fever",
    howItWorks: "reduces pain signals and fever in the brain; it has little anti-inflammatory effect",
    warning: "too much can cause serious liver damage, especially with alcohol or other paracetamol-containing products",
    sideEffects: "rare at normal doses; skin rash or allergic reaction",
  },
  ibuprofen: {
    generic: "ibuprofen",
    brand: "Brufen",
    aliases: ["ibuprofen", "brufen", "advil", "nurofen"],
    uses: "pain, fever and inflammation (muscle pain, period pain, joint pain)",
    howItWorks: "an NSAID that blocks COX enzymes and lowers prostaglandins",
    warning: "can cause stomach bleeding and kidney problems; take with food and avoid with ulcers",
    sideEffects: "heartburn, nausea, stomach upset, dizziness",
  },
  amoxicillin: {
    generic: "amoxicillin",
    brand: "Augmentin",
    aliases: ["amoxicillin", "amoxicillin clavulanate", "co-amoxiclav", "augmentin", "amoxil"],
    uses: "bacterial infections such as ear, sinus, chest, skin and urinary infections",
    howItWorks: "a penicillin antibiotic that stops bacteria building their cell wall",
    warning: "do not take if allergic to penicillin; finish the full course even if you feel better",
    sideEffects: "diarrhoea, nausea, skin rash",
  },
  metformin: {
    generic: "metformin",
    brand: "Glucophage",
    aliases: ["metformin", "glucophage"],
    uses: "type 2 diabetes, to lower blood sugar",
    howItWorks: "reduces sugar made by the liver and helps the body use insulin better",
    warning: "rarely causes lactic acidosis; tell your doctor about kidney problems or before contrast scans",
    sideEffects: "nausea, diarrhoea, metallic taste, stomach upset (usually settles)",
  },
  cetirizine: {
    generic: "cetirizine",
    brand: "Zyrtec",
    aliases: ["cetirizine", "zyrtec"],
    uses: "allergies: sneezing, runny nose, itchy eyes, hives",
    howItWorks: "an antihistamine that blocks histamine H1 receptors",
    warning: "may cause drowsiness; avoid alcohol and take care when driving",
    sideEffects: "drowsiness, dry mouth, tiredness",
  },
  omeprazole: {
    generic: "omeprazole",
    brand: "Risek",
    aliases: ["omeprazole", "risek", "losec"],
    uses: "acidity, heartburn, GERD and stomach ulcers",
    howItWorks: "a proton pump inhibitor that lowers stomach acid production",
    warning: "long-term use can lower magnesium and vitamin B12; see a doctor if symptoms persist",
    sideEffects: "headache, stomach pain, nausea, diarrhoea",
  },
};

export const DEFAULT_DRUG = "paracetamol";

/**
 * Build a Citation for a drug label section.
 * @returns {import("../types.js").Citation}
 */
export function cite(n, drug, section) {
  return { n, drug, section, url: `${FDA_URL}?search=openfda.generic_name:${encodeURIComponent(drug)}` };
}

/** Products keyed by generic name. Prices in PKR. No batchId: mock cards add to cart by name. */
export const PRODUCTS = {
  paracetamol: {
    medicineId: "prod-panadol-500",
    name: "Panadol 500mg (10 tablets)",
    genericName: "paracetamol",
    price: 45,
    currency: "PKR",
    inStock: true,
    pharmacyName: "Demo Pharmacy",
  },
  ibuprofen: {
    medicineId: "prod-brufen-400",
    name: "Brufen 400mg (10 tablets)",
    genericName: "ibuprofen",
    price: 75,
    currency: "PKR",
    inStock: true,
    pharmacyName: "Demo Pharmacy",
  },
  amoxicillin: {
    medicineId: "prod-augmentin-625",
    name: "Augmentin 625mg (6 tablets)",
    genericName: "amoxicillin + clavulanic acid",
    price: 590,
    currency: "PKR",
    inStock: true,
    pharmacyName: "Demo Pharmacy",
  },
  metformin: {
    medicineId: "prod-glucophage-500",
    name: "Glucophage 500mg (30 tablets)",
    genericName: "metformin",
    price: 165,
    currency: "PKR",
    inStock: true,
    pharmacyName: "Demo Pharmacy",
  },
  cetirizine: {
    medicineId: "prod-zyrtec-10",
    name: "Zyrtec 10mg (10 tablets)",
    genericName: "cetirizine",
    price: 295,
    currency: "PKR",
    inStock: true,
    pharmacyName: "Demo Pharmacy",
  },
  omeprazole: {
    medicineId: "prod-risek-20",
    name: "Risek 20mg (14 capsules)",
    genericName: "omeprazole",
    price: 480,
    currency: "PKR",
    inStock: true,
    pharmacyName: "Demo Pharmacy",
  },
};

/** Two in-stock generic alternatives per drug, used by the out-of-stock scenario. */
export const ALTERNATIVES = Object.fromEntries(
  Object.entries(PRODUCTS).map(([key, p]) => [
    key,
    [
      {
        medicineId: `${p.medicineId}-gen-a`,
        name: `${DRUGS[key].generic[0].toUpperCase()}${DRUGS[key].generic.slice(1)} (generic, pack A)`,
        genericName: p.genericName,
        price: Math.round(p.price * 0.7),
        currency: "PKR",
        inStock: true,
        pharmacyName: "Demo Pharmacy",
      },
      {
        medicineId: `${p.medicineId}-gen-b`,
        name: `${DRUGS[key].generic[0].toUpperCase()}${DRUGS[key].generic.slice(1)} (generic, pack B)`,
        genericName: p.genericName,
        price: Math.round(p.price * 0.85),
        currency: "PKR",
        inStock: true,
        pharmacyName: "Demo Pharmacy",
      },
    ],
  ])
);

export const EMERGENCY_MESSAGE =
  "This may be a medical emergency. Call **1122** (Rescue) or go to the nearest emergency department now. " +
  "Do not wait for an online reply. If someone has taken too much of a medicine, bring the pack with you.";

export const NO_EVIDENCE_MESSAGE =
  "I couldn't find reliable information about this in our drug sources, so I won't guess. " +
  "Try the generic name (for example *paracetamol* instead of a brand), or ask a pharmacist.";

/**
 * Seed state: 4 past sessions for the current customer, with their messages.
 * Two escalations below belong to these sessions (msg-s2-2 pending, msg-s3-2 answered).
 */
export function createSeedState() {
  const sessions = [
    { id: "sess-1", title: "Panadol vs Brufen for headache", createdAt: ago(60 * 26), updatedAt: ago(60 * 26 - 3) },
    { id: "sess-2", title: "Metformin dose with dinner", createdAt: ago(60 * 5), updatedAt: ago(60 * 5 - 1) },
    { id: "sess-3", title: "Bachay ko Zyrtec de sakte hain?", createdAt: ago(60 * 24 * 3), updatedAt: ago(60 * 24 * 2) },
    { id: "sess-4", title: "Risek stock hai?", createdAt: ago(60 * 24 * 6), updatedAt: ago(60 * 24 * 6 - 1) },
  ];

  const messages = {
    "sess-1": [
      {
        id: "msg-s1-1",
        sessionId: "sess-1",
        role: "user",
        content: "What is the difference between Panadol and Brufen for a headache?",
        createdAt: ago(60 * 26),
      },
      {
        id: "msg-s1-2",
        sessionId: "sess-1",
        role: "assistant",
        content:
          "Both can help a headache, but they work differently:\n\n" +
          "- **Panadol (paracetamol)** lowers pain and fever, and is gentle on the stomach [1]\n" +
          "- **Brufen (ibuprofen)** is an NSAID, so it also reduces inflammation [2]\n" +
          "- Brufen can irritate the stomach, so take it with food and avoid it if you have ulcers [3]\n\n" +
          "For a simple tension headache, paracetamol is usually tried first.",
        createdAt: ago(60 * 26 - 1),
        citations: [
          cite(1, "paracetamol", "Indications and Usage"),
          cite(2, "ibuprofen", "Clinical Pharmacology"),
          cite(3, "ibuprofen", "Warnings and Precautions"),
        ],
        meta: { messageId: "msg-s1-2", sessionId: "sess-1", route: "knowledge", escalated: false, latencyMs: 1840 },
        feedback: 1,
      },
    ],
    "sess-2": [
      {
        id: "msg-s2-1",
        sessionId: "sess-2",
        role: "user",
        content: "I take metformin 500. Should I increase my dose if my sugar is still high after dinner?",
        createdAt: ago(60 * 5),
      },
      {
        id: "msg-s2-2",
        sessionId: "sess-2",
        role: "assistant",
        content:
          "Changing your own dose needs a pharmacist or doctor, so I've sent your question to our pharmacist. " +
          "In general, metformin is taken with meals to reduce stomach upset [1], and the dose is adjusted " +
          "slowly based on blood sugar readings and kidney function [2]. Please don't change your dose until you hear back.",
        createdAt: ago(60 * 5 - 1),
        citations: [
          cite(1, "metformin", "Dosage and Administration"),
          cite(2, "metformin", "Warnings and Precautions"),
        ],
        meta: {
          messageId: "msg-s2-2",
          sessionId: "sess-2",
          route: "escalated",
          escalated: true,
          escalationReason: "personal_dosing",
          escalationStatus: "pending",
          latencyMs: 2210,
        },
      },
    ],
    "sess-3": [
      {
        id: "msg-s3-1",
        sessionId: "sess-3",
        role: "user",
        content: "Mera beta 4 saal ka hai, kya usay Zyrtec de sakte hain?",
        createdAt: ago(60 * 24 * 3),
      },
      {
        id: "msg-s3-2",
        sessionId: "sess-3",
        role: "assistant",
        content:
          "Bachon ke liye dawa ka faisla pharmacist ya doctor karta hai, is liye maine aap ka sawal pharmacist ko bhej diya hai. " +
          "Aam taur par cetirizine allergy ki dawa hai [1], aur bachon mein iski miqdar umar aur wazan ke hisaab se hoti hai [2].",
        createdAt: ago(60 * 24 * 3 - 1),
        citations: [
          cite(1, "cetirizine", "Indications and Usage"),
          cite(2, "cetirizine", "Use in Specific Populations"),
        ],
        meta: {
          messageId: "msg-s3-2",
          sessionId: "sess-3",
          route: "escalated",
          escalated: true,
          escalationReason: "pregnancy_or_child",
          escalationStatus: "answered",
          latencyMs: 1990,
        },
      },
      {
        id: "msg-s3-3",
        sessionId: "sess-3",
        role: "pharmacist",
        content:
          "Assalam o Alaikum. 4 saal ke bachay ke liye Zyrtec ka syrup behtar hai, tablet nahi. " +
          "Miqdar bachay ke wazan par depend karti hai, is liye apne bachon ke doctor se confirm karein ya store par aa kar wazan bata dein.",
        createdAt: ago(60 * 24 * 2),
      },
    ],
    "sess-4": [
      {
        id: "msg-s4-1",
        sessionId: "sess-4",
        role: "user",
        content: "Risek 20 stock mein hai?",
        createdAt: ago(60 * 24 * 6),
      },
      {
        id: "msg-s4-2",
        sessionId: "sess-4",
        role: "assistant",
        content: "Ji haan, **Risek 20mg** stock mein hai. 14 capsules ka pack $480.00 ka hai.",
        createdAt: ago(60 * 24 * 6 - 1),
        meta: {
          messageId: "msg-s4-2",
          sessionId: "sess-4",
          route: "product",
          escalated: false,
          products: [PRODUCTS.omeprazole],
          latencyMs: 640,
        },
        feedback: -1,
      },
    ],
  };

  /** 8 escalations: 5 pending, 3 answered. Only msg-s2-2 and msg-s3-2 belong to the sessions above. */
  const escalations = [
    {
      id: "esc-1",
      messageId: "msg-s2-2",
      customerFirstName: "Ahmed",
      question: "I take metformin 500. Should I increase my dose if my sugar is still high after dinner?",
      reason: "personal_dosing",
      status: "pending",
      createdAt: ago(60 * 5 - 1),
      sources: [cite(1, "metformin", "Dosage and Administration"), cite(2, "metformin", "Warnings and Precautions")],
    },
    {
      id: "esc-2",
      messageId: "msg-ext-2",
      customerFirstName: "Sana",
      question: "I'm 3 months pregnant, can I take Brufen for back pain?",
      reason: "pregnancy_or_child",
      status: "pending",
      createdAt: ago(42),
      sources: [cite(1, "ibuprofen", "Use in Specific Populations"), cite(2, "ibuprofen", "Warnings and Precautions")],
    },
    {
      id: "esc-3",
      messageId: "msg-ext-3",
      customerFirstName: "Bilal",
      question: "Can I buy Augmentin 625 without a prescription for my sore throat?",
      reason: "prescription_only",
      status: "pending",
      createdAt: ago(95),
      sources: [cite(1, "amoxicillin", "Indications and Usage")],
    },
    {
      id: "esc-4",
      messageId: "msg-ext-4",
      customerFirstName: "Hina",
      question: "Panadol kitni dafa le sakti hoon ek din mein? Mujhe liver ka masla hai.",
      reason: "personal_dosing",
      status: "pending",
      createdAt: ago(60 * 3),
      sources: [cite(1, "paracetamol", "Dosage and Administration"), cite(2, "paracetamol", "Warnings and Precautions")],
    },
    {
      id: "esc-5",
      messageId: "msg-ext-5",
      customerFirstName: "Usman",
      question: "Does 'Neuroxa forte' interact with omeprazole?",
      reason: "no_evidence",
      status: "pending",
      createdAt: ago(60 * 8),
      sources: [],
    },
    {
      id: "esc-6",
      messageId: "msg-s3-2",
      customerFirstName: "Ahmed",
      question: "Mera beta 4 saal ka hai, kya usay Zyrtec de sakte hain?",
      reason: "pregnancy_or_child",
      status: "answered",
      createdAt: ago(60 * 24 * 3 - 1),
      sources: [cite(1, "cetirizine", "Indications and Usage"), cite(2, "cetirizine", "Use in Specific Populations")],
      reply:
        "Assalam o Alaikum. 4 saal ke bachay ke liye Zyrtec ka syrup behtar hai, tablet nahi. " +
        "Miqdar bachay ke wazan par depend karti hai, is liye apne bachon ke doctor se confirm karein ya store par aa kar wazan bata dein.",
      answeredAt: ago(60 * 24 * 2),
    },
    {
      id: "esc-7",
      messageId: "msg-ext-7",
      customerFirstName: "Ayesha",
      question: "My 8-year-old has a fever of 101. How much Panadol syrup should I give?",
      reason: "pregnancy_or_child",
      status: "answered",
      createdAt: ago(60 * 24 * 4),
      sources: [cite(1, "paracetamol", "Use in Specific Populations")],
      reply:
        "For children the dose is based on weight, not age. Please check the syrup strength on the bottle and share your " +
        "child's weight, or visit the store and we'll measure it with you. If the fever lasts more than 3 days, see a doctor.",
      answeredAt: ago(60 * 24 * 4 - 30),
    },
    {
      id: "esc-8",
      messageId: "msg-ext-8",
      customerFirstName: "Kamran",
      question: "Can I take omeprazole 40 every day for 6 months?",
      reason: "personal_dosing",
      status: "answered",
      createdAt: ago(60 * 24 * 5),
      sources: [cite(1, "omeprazole", "Warnings and Precautions")],
      reply:
        "Long-term daily use should be reviewed by your doctor. Using it for many months can lower magnesium and " +
        "vitamin B12, so a check-up and blood test are a good idea before continuing.",
      answeredAt: ago(60 * 24 * 5 - 120),
    },
  ];

  return { sessions, messages, escalations };
}
