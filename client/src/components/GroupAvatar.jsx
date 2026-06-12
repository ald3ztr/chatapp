// Grup avatari (FAZ 5) - foto varsa gosterir, yoksa grup ikonu.

import { Users } from './Icons.jsx';

export default function GroupAvatar({ group, size = 52, className = '' }) {
  const style = { width: size, height: size };
  if (group?.avatarUrl) {
    return (
      <img
        src={group.avatarUrl}
        alt={group.name}
        style={style}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      style={style}
      className={`flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white ${className}`}
    >
      <Users size={size * 0.5} />
    </div>
  );
}
