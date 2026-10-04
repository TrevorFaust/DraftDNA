export function ShotStage({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover object-left-top"
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}
