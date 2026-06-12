// Arama arayuzu (WebRTC) - gelen arama / araniyor / goruseme ekrani.

import { useEffect, useRef, useState } from 'react';
import { useCall } from '../context/CallContext.jsx';
import Avatar from './Avatar.jsx';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from './Icons.jsx';

function CallTimer() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setS((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="tabular-nums">
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
    </span>
  );
}

// Bir <video>/<audio> ogesine MediaStream bagla
function Media({ stream, audio, muted, className }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  return audio ? (
    <audio ref={ref} autoPlay playsInline />
  ) : (
    <video ref={ref} autoPlay playsInline muted={muted} className={className} />
  );
}

export default function CallOverlay() {
  const {
    status, peer, callType, localStream, remoteStream, muted, videoOff,
    acceptCall, rejectCall, endCall, toggleMute, toggleVideo,
  } = useCall();

  if (status === 'idle' || !peer) return null;

  const isVideo = callType === 'video';
  const ctrlBtn = 'flex h-14 w-14 items-center justify-center rounded-full text-white';

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-neutral-900 text-white">
      {/* Goruntulu + bagli: uzak video tam ekran, yerel kucuk */}
      {status === 'connected' && isVideo && remoteStream ? (
        <Media stream={remoteStream} className="absolute inset-0 h-full w-full bg-black object-cover" />
      ) : (
        // Sesli arama / baglanmadan once: avatar + isim
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Avatar user={peer} size={120} />
          <p className="text-2xl font-semibold">{peer.username}</p>
          <p className="text-white/70">
            {status === 'incoming' && `${isVideo ? 'Goruntulu' : 'Sesli'} arama...`}
            {status === 'calling' && 'Araniyor...'}
            {status === 'connected' && <CallTimer />}
          </p>
        </div>
      )}

      {/* Goruntulu konusmada yerel kamera (kucuk pencere) */}
      {status === 'connected' && isVideo && localStream && (
        <div className="absolute right-4 top-4 h-40 w-28 overflow-hidden rounded-xl border border-white/20 bg-black">
          <Media stream={localStream} muted className="h-full w-full object-cover" />
        </div>
      )}

      {/* Uzak ses (sesli aramada duyulsun) */}
      {status === 'connected' && !isVideo && remoteStream && <Media stream={remoteStream} audio />}

      {/* Ust bilgi (goruntulu tam ekranda isim) */}
      {status === 'connected' && isVideo && (
        <div className="absolute left-4 top-4 rounded-full bg-black/40 px-3 py-1 text-sm">
          {peer.username} · <CallTimer />
        </div>
      )}

      {/* Kontroller */}
      <div className="relative z-10 flex items-center justify-center gap-5 pb-10 pt-6"
           style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))' }}>
        {status === 'incoming' ? (
          <>
            <button onClick={rejectCall} className={`${ctrlBtn} bg-red-500`} aria-label="Reddet">
              <PhoneOff size={26} />
            </button>
            <button onClick={acceptCall} className={`${ctrlBtn} bg-green-500`} aria-label="Kabul et">
              <Phone size={26} />
            </button>
          </>
        ) : (
          <>
            {status === 'connected' && (
              <button onClick={toggleMute} className={`${ctrlBtn} ${muted ? 'bg-white text-neutral-900' : 'bg-white/15'}`} aria-label="Sesi ac/kapat">
                {muted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
            )}
            {status === 'connected' && isVideo && (
              <button onClick={toggleVideo} className={`${ctrlBtn} ${videoOff ? 'bg-white text-neutral-900' : 'bg-white/15'}`} aria-label="Kamerayi ac/kapat">
                {videoOff ? <VideoOff size={24} /> : <Video size={24} />}
              </button>
            )}
            <button onClick={endCall} className={`${ctrlBtn} bg-red-500`} aria-label="Aramayi bitir">
              <PhoneOff size={26} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
