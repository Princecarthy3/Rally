"use client";

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  title?: string;
};

function base({ size = 20, title, className, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    className: className ? `inline-block shrink-0 ${className}` : "inline-block shrink-0",
    "aria-hidden": title ? undefined : (true as const),
    role: title ? ("img" as const) : undefined,
    ...rest,
  };
}

const s = "currentColor";

export function IconTrophy(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M8 4h8v3a4 4 0 01-8 0V4z" stroke={s} strokeWidth="1.8" />
      <path d="M8 5H5a2 2 0 002 4h1M16 5h3a2 2 0 01-2 4h-1" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 11h4v3l-2 2-2-2v-3z" stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 20h6M12 16v4" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconSkull(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M12 3c4.5 0 7 3 7 7 0 2.5-1 4-2 5v3H7v-3c-1-1-2-2.5-2-5 0-4 2.5-7 7-7z" stroke={s} strokeWidth="1.8" />
      <circle cx="9.5" cy="10" r="1.5" fill={s} />
      <circle cx="14.5" cy="10" r="1.5" fill={s} />
      <path d="M10 15h4M9 20h2M13 20h2" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconHandshake(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M4 12l4-3 3 2 2-2 3 2 4-3" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 14l2 4M12 12l1 5M16 13l-1 4" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconClock(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <circle cx="12" cy="12" r="8" stroke={s} strokeWidth="1.8" />
      <path d="M12 8v5l3 2" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBolt(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M13 2L6 13h5l-1 9 8-12h-5l1-8z" stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function IconFire(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M12 3c2 3 1 5 3 7 1 1 2 2 2 5a5 5 0 11-10 0c0-2 1-3 2-5 1-2 1-4 3-7z" stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 14c1 .5 2 1.5 2 3a2 2 0 11-4 0c0-1.2.8-2 2-3z" stroke={s} strokeWidth="1.5" />
    </svg>
  );
}

export function IconTarget(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <circle cx="12" cy="12" r="8" stroke={s} strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.5" stroke={s} strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1.5" fill={s} />
    </svg>
  );
}

export function IconDice(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <rect x="4" y="4" width="16" height="16" rx="3" stroke={s} strokeWidth="1.8" />
      <circle cx="8.5" cy="8.5" r="1.3" fill={s} />
      <circle cx="15.5" cy="8.5" r="1.3" fill={s} />
      <circle cx="12" cy="12" r="1.3" fill={s} />
      <circle cx="8.5" cy="15.5" r="1.3" fill={s} />
      <circle cx="15.5" cy="15.5" r="1.3" fill={s} />
    </svg>
  );
}

export function IconCheck(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M5 12l5 5L20 7" stroke={s} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconX(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M6 6l12 12M18 6L6 18" stroke={s} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconArrowUp(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M12 19V5M6 11l6-6 6 6" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconArrowDown(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M12 5v14M6 13l6 6 6-6" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconArrowRight(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M5 12h14M13 6l6 6-6 6" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconQuestion(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <circle cx="12" cy="12" r="9" stroke={s} strokeWidth="1.8" />
      <path d="M9.5 9.5a2.5 2.5 0 114 2c-.8.5-1.5 1-1.5 2.5" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill={s} />
    </svg>
  );
}

export function IconShip(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M3 14h18l-2 4H5l-2-4z" stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M6 14V8h4v2h5V6h3v8" stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M2 20c2-1 4-1 6 0s4 1 6 0 4-1 6 0" stroke={s} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconExplosion(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M12 3l1.5 5.5L19 7l-3.5 4L21 14l-5.5.5L17 21l-5-3.5L7 21l1.5-6.5L3 14l5.5-3L5 7l5.5 1.5L12 3z" stroke={s} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function IconFlag(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M6 21V4" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 5h11l-2 3.5L17 12H6" stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPencil(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M14 5l5 5-11 11H3v-5L14 5z" stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 7l5 5" stroke={s} strokeWidth="1.8" />
    </svg>
  );
}

export function IconSwords(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M5 4l6 6M4 5l2 8M15 4l-6 6M20 5l-2 8" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 11l6 6M15 11l-6 6" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 19h8" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconFinish(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M5 21V4" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 4h10l-1.5 3L15 10H5" stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 14h3M8 17h3" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconLightbulb(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M9 18h6M10 21h4" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 3a6 6 0 014 10c-.8.7-1.2 1.5-1.4 2.5H9.4C9.2 14.5 8.8 13.7 8 13a6 6 0 014-10z" stroke={s} strokeWidth="1.8" />
    </svg>
  );
}

export function IconPhoneRotate(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <rect x="7" y="3" width="10" height="18" rx="2" stroke={s} strokeWidth="1.8" />
      <path d="M11 18h2" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 8a5 5 0 015 5M22 10v3h-3" stroke={s} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconStar(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M12 3l2.4 6.5H21l-5.2 4 2 6.5L12 16.5 6.2 20l2-6.5L3 9.5h6.6L12 3z" stroke={s} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPoint(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M8 5v14l10-7L8 5z" stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function IconMegaphone(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M4 10v4h3l8 4V6L7 10H4z" stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M18 9a3 3 0 010 6M7 14v3a2 2 0 004 0v-1" stroke={s} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconParty(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M6 20l4-10 10 4-4 6H6z" stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 6l1-3M16 8l3-2M9 9l-2-3" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconAlert(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M12 4l9 16H3L12 4z" stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 10v4M12 17h.01" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconSkip(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <circle cx="12" cy="12" r="9" stroke={s} strokeWidth="1.8" />
      <path d="M8 8l8 8M16 8l-8 8" stroke={s} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconReverse(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M7 8h8a4 4 0 010 8h-2" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 5L7 8l3 3M14 13l3 3-3 3" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconRainbow(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M4 16a8 8 0 0116 0" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 16a5 5 0 0110 0" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 16a2 2 0 014 0" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconPlusTwo(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M12 7v10M7 12h10" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <path d="M16 16h4M18 14v4" stroke={s} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconRock(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M8 11c0-2.5 2-4 4-4s4 1.5 4 4v5c0 2.5-2 4-4 4s-4-1.5-4-4v-5z" stroke={s} strokeWidth="1.8" />
      <path d="M9 10V7.5a1.5 1.5 0 013 0V10M13 10V7a1.5 1.5 0 013 0v3" stroke={s} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconPaper(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M8 4h6l4 4v12H8V4z" stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 4v4h4M10 12h6M10 15h6M10 18h4" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconScissors(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <circle cx="7" cy="7" r="3" stroke={s} strokeWidth="1.8" />
      <circle cx="7" cy="17" r="3" stroke={s} strokeWidth="1.8" />
      <path d="M9.5 8.5L20 18M9.5 15.5L20 6" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconBasketball(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <circle cx="12" cy="12" r="9" stroke={s} strokeWidth="1.8" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke={s} strokeWidth="1.5" />
    </svg>
  );
}

export function IconShield(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function IconFist(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M7 11V8a1.5 1.5 0 013 0v3M10 11V7a1.5 1.5 0 013 0v4M13 11V7.5a1.5 1.5 0 013 0V11M16 11v-1a1.5 1.5 0 013 0v3c0 3-2 5-5 5H9c-2.5 0-4-2-4-4.5V13a2 2 0 012-2h0" stroke={s} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCards(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <rect x="5" y="6" width="10" height="14" rx="1.5" stroke={s} strokeWidth="1.8" transform="rotate(-8 10 13)" />
      <rect x="9" y="4" width="10" height="14" rx="1.5" stroke={s} strokeWidth="1.8" />
    </svg>
  );
}

export function IconScale(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M12 4v16M8 20h8" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 8h16M6 8l-2 6h6L8 8M18 8l-2 6h6l-2-6" stroke={s} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPass(p: IconProps) {
  const props = base(p);
  return (
    <svg {...props}>
      {p.title ? <title>{p.title}</title> : null}
      <path d="M5 12h10M11 6l6 6-6 6" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 6v12" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
