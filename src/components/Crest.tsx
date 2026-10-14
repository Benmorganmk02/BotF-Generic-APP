import logoUrl from '../assets/logo.webp';

/** The game's emblem: shield, sword and bow. Same artwork as the website — swap src/assets/logo.webp to change it. */
export default function Crest({ className = '' }: { className?: string }) {
  return <img src={logoUrl} alt="" aria-hidden width={512} height={512} className={`object-contain ${className}`} />;
}
