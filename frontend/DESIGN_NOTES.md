# Direction visuelle

Inspirée du système Orange « Boosted », sans reproduire le site Orange.

## Tokens
- Orange `#FF7900` (accent, boutons principaux avec texte noir)
- Orange lisible `#A34700` pour du texte orange sur fond clair
- Noir `#000000`, blanc, papier `#F6F6F6`, gris texte `#595959`
- Rouge fonctionnel `#CD3C14`, vert fonctionnel `#228722`
- Typographie : Helvetica Neue (police de marque), chiffres tabulaires dans les tableaux
- Angles droits ; focus : contour noir + ombre orange décalée

## Mouvement
- Un seul mouvement ambiant : la grille de carrés de l'écran de connexion (`components/brand/SignalGrid.tsx`).
- Tout le reste répond à une action : coche dessinée, ouverture de la description,
  compteur, erreurs qui tremblent, progression des étapes, indicateur du menu admin,
  transition entre sections, apparition des lignes de tableau, jauge de fin de session.
- `prefers-reduced-motion` désactive toutes les animations.

## Composants partagés (`components/brand/`)
- `AuthShell` : écran de connexion (collaborateur, admin, inscription admin)
- `SignalGrid` : grille animée, rendu déterministe (pas d'écart serveur/client)
- `PortalHeader` : en-tête noir avec déconnexion
- `PasswordInput` : champ mot de passe avec bouton afficher/masquer

## Lancer le frontend

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Le frontend attend le backend à l'adresse définie par `NEXT_PUBLIC_API_BASE_URL`.
