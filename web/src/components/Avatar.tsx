import Image from 'next/image';
import { avatarSrc } from '@/lib/format';

export function Avatar({ id, size = 40, className = '' }: { id: string; size?: number; className?: string }) {
  return (
    <Image src={avatarSrc(id)} alt="" width={size} height={size}
      className={`shrink-0 rounded-md border border-line bg-panel-2 object-cover ${className}`} style={{ width: size, height: size }} />
  );
}
