// Profil avatari (FAZ 1)
// Fotograf varsa gosterir, yoksa kullanici adinin ilk harfini renkli daire icinde.

function initial(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

// Kullanici adina gore tutarli bir gradyan rengi sec
const GRADIENTS = [
  'from-pink-500 to-rose-500',
  'from-violet-500 to-purple-500',
  'from-sky-500 to-blue-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-fuchsia-500 to-pink-500',
];
function gradientFor(name) {
  let sum = 0;
  for (const ch of name || '') sum += ch.charCodeAt(0);
  return GRADIENTS[sum % GRADIENTS.length];
}

export default function Avatar({ user, size = 48, className = '' }) {
  const style = { width: size, height: size };
  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.username}
        style={style}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      style={{ ...style, fontSize: size * 0.42 }}
      className={`flex items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ${gradientFor(
        user?.username
      )} ${className}`}
    >
      {initial(user?.username)}
    </div>
  );
}
