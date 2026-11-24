import { useState } from 'react';
import { CarFront } from 'lucide-react';

interface VehicleImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export function VehicleImage({ src, alt, className = 'w-full h-full object-cover' }: VehicleImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#1B1B1B] via-[#202020] to-[#080808] flex flex-col items-center justify-center gap-2 text-[#A6A6A6] p-4">
        <CarFront className="w-9 h-9 text-[#20D94B]/70" />
        <span className="text-xs font-medium text-center line-clamp-1">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
