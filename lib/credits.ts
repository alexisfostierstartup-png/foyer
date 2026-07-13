// Crédits de modification — FICTIFS (Wizard-of-Oz). Ils vivent dans le navigateur : rien
// n'est débité, rien n'est persisté côté serveur. Ils servent à faire vivre le mur de
// paiement du parcours de test (1 modification offerte, puis achat simulé).
// Le jour où la facturation est réelle, cette source de vérité passe côté projet.

const CLE = "foyer_credits_modif";

export const MODIFS_OFFERTES = 1;

function lire(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(CLE) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export function creditsAchetes(projectId: string): number {
  return lire()[projectId] ?? 0;
}

export function ajouterCredits(projectId: string, credits: number): number {
  const tout = lire();
  const total = (tout[projectId] ?? 0) + credits;
  tout[projectId] = total;
  try {
    window.localStorage.setItem(CLE, JSON.stringify(tout));
  } catch {
    // Stockage indisponible (navigation privée) : l'achat vaut alors pour la session en
    // cours seulement — on n'empêche pas l'utilisateur de continuer.
  }
  return total;
}

/** Modifications autorisées en tout : l'offerte + celles achetées. */
export function modifsAutorisees(projectId: string): number {
  return MODIFS_OFFERTES + creditsAchetes(projectId);
}
