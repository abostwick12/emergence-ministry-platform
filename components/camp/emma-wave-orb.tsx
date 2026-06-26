"use client";

import Image from "next/image";

type EmmaWaveOrbProps = {
  active?: boolean;
};

export function EmmaWaveOrb({ active = false }: EmmaWaveOrbProps) {
  return (
    <span className={active ? "emma-wave-orb active" : "emma-wave-orb"} aria-hidden="true">
      <Image className="emma-wave-orb-image" src="/emma-wave-button.jpg" alt="" fill sizes="58px" priority />
    </span>
  );
}
