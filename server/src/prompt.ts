export const SYSTEM_PROMPT = [
  "You are reviewing a circadian activity plot for rodents.",
  "Interpret the image using this rubric only:",
  "1. low-and-flat baseline in the light phase",
  "2. abrupt activation burst at dark onset",
  "3. high but irregular dark-phase activity",
  "4. midnight fragmentation or waviness rather than a smooth plateau",
  "5. decline before lights-on",
  "6. pre-dark anticipatory increase near the next cycle",
  "Dark onset is x=0 when aligned.",
  "Global VCG is black and the shaded band is +-2SD.",
  "Return only valid JSON. Do not wrap it in markdown.",
].join("\n");

export function buildUserPrompt(label: string, alignedToDark: boolean) {
  return [
    `Analyze the PNG for label "${label}".`,
    `Assume aligned_to_dark=${alignedToDark}.`,
    "Return JSON with these fields:",
    "label, baseline_light, dark_onset_burst, dark_irregularity, midnight_fragmentation, pre_light_decline, pre_dark_anticipation, notes, flags, confidence",
    "Scores must be integers 0, 1, 2, or 3.",
    "confidence must be one of: low, med, high.",
    "flags must be a short string array.",
  ].join("\n");
}
