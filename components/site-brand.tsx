import Image from "next/image";
import Link from "next/link";

type SiteBrandProps = {
  href?: string;
  admin?: boolean;
  className?: string;
};

export function SiteBrand({ href = "/", admin = false, className = "" }: SiteBrandProps) {
  return (
    <Link
      className={`brand site-brand ${className}`.trim()}
      href={href}
      aria-label={`Bel's Kitchen Catering Service${admin ? " admin" : ""}`}
    >
      <Image
        className="brand-logo-image"
        src="/bels-kitchen-logo.png"
        alt="Bel's Kitchen Catering Service logo"
        width={1039}
        height={1029}
        sizes="56px"
        unoptimized
      />
      <span className="brand-wordmark">
        <strong>BEL&apos;S KITCHEN</strong>
        <small>CATERING SERVICE{admin ? " · ADMIN" : ""}</small>
      </span>
    </Link>
  );
}
