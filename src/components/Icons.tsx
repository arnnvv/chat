import { KeyRound, type LucideProps, UserPlus } from "lucide-react";
import type { JSX } from "react";

export const Icons = {
  Logo: (_props: LucideProps): JSX.Element => (
    <svg width="50" height="50" viewBox="-100 -100 200 200">
      <defs>
        <path
          id="branch"
          d="
        M 0 0 L 0 -90
        M 0 -20 L 20 -34
        M 0 -20 L -20 -34
        M 0 -40 L 20 -54
        M 0 -40 L -20 -54
        M 0 -60 L 20 -74
        M 0 -60 L -20 -74"
          stroke="#E5C39C"
          strokeWidth="5"
        />
      </defs>

      <use href="#branch" />
      <use href="#branch" transform="rotate(60)" />
      <use href="#branch" transform="rotate(120)" />
      <use href="#branch" transform="rotate(180)" />
      <use href="#branch" transform="rotate(240)" />
      <use href="#branch" transform="rotate(300)" />
    </svg>
  ),
  UserPlus,
  KeyRound,
};

export type Icon = keyof typeof Icons;
