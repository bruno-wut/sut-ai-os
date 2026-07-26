import Image from "next/image";

type BrandWordmarkProps = Readonly<{
  priority?: boolean;
}>;

export function BrandWordmark({ priority = false }: BrandWordmarkProps) {
  return (
    <Image
      alt="Sri U-Thong Grand Hotel"
      className="brand-wordmark"
      height={542}
      priority={priority}
      src="/images/sri-u-thong-wordmark.png"
      width={2169}
    />
  );
}
