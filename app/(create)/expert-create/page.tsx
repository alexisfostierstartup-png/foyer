import { redirect } from "next/navigation";

// Entrée du flux expert. Le rendu expert reprend une disposition existante (il faut
// d'abord une pièce + un rendu), donc on démarre le parcours standard ; le rendu
// expert est proposé en fin de parcours (écran final → "Rendu expert").
export default function ExpertCreatePage() {
  redirect("/create");
}
