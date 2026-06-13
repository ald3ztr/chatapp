// Sesli/goruntulu arama (WebRTC) - durum + RTCPeerConnection yonetimi.
// Socket.IO sinyallesme; medya icin ucretsiz Google STUN. (HTTPS/localhost gerekir.)

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { useSocket } from './SocketContext.jsx';

const CallContext = createContext(null);

const ICE_CONFIG = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
};

export function CallProvider({ children }) {
  const { user } = useAuth();
  const { socket, connected } = useSocket();

  // 'idle' | 'calling' | 'incoming' | 'connected'
  const [status, setStatus] = useState('idle');
  const [peer, setPeer] = useState(null);
  const [callType, setCallType] = useState('audio');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [error, setError] = useState('');

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerRef = useRef(null); // o an goruseilen kullanici
  const incomingOfferRef = useRef(null);
  const pendingIceRef = useRef([]);
  const cameraTrackRef = useRef(null); // ekran paylasiminda saklanan kamera track'i
  const screenTrackRef = useRef(null);
  const screenAudioTrackRef = useRef(null); // ekran paylasiminin sistem sesi
  const screenAudioSenderRef = useRef(null);
  const remoteStreamRef = useRef(null); // gelen track'leri tek stream'de topla

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    screenAudioTrackRef.current?.stop();
    screenAudioTrackRef.current = null;
    screenAudioSenderRef.current = null;
    cameraTrackRef.current?.stop();
    cameraTrackRef.current = null;
    remoteStreamRef.current = null;
    peerRef.current = null;
    incomingOfferRef.current = null;
    pendingIceRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setVideoOff(false);
    setScreenSharing(false);
    setStatus('idle');
    setPeer(null);
  }, []);

  // RTCPeerConnection olustur + ortak kurulum
  const buildPeerConnection = useCallback(
    (otherId) => {
      const pc = new RTCPeerConnection(ICE_CONFIG);
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.current?.emit('call:ice', { toUserId: otherId, candidate: e.candidate });
      };
      // Gelen track'leri tek stream'de topla (ekran sesi gibi sonradan eklenenler video'yu bozmasin)
      pc.ontrack = (e) => {
        if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
        if (!remoteStreamRef.current.getTracks().includes(e.track)) {
          remoteStreamRef.current.addTrack(e.track);
        }
        e.track.onended = () => {
          remoteStreamRef.current?.removeTrack(e.track);
          if (remoteStreamRef.current) setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
        };
        setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') tuneVideoSender({ screen: false });
        if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
          // baglanti koptu
          if (pcRef.current === pc) endCall();
        }
      };
      pcRef.current = pc;
      return pc;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [socket]
  );

  // Gonderilen video'nun bit hizi/fps sinirini ac (akici 60fps ekran paylasimi icin)
  async function tuneVideoSender({ screen = false } = {}) {
    const sender = pcRef.current?.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (!sender) return;
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
      // Ekran paylasiminda yuksek bit hizi + 60fps; kamerada makul deger
      params.encodings[0].maxBitrate = screen ? 12_000_000 : 3_000_000;
      params.encodings[0].maxFramerate = screen ? 60 : 30;
      params.degradationPreference = screen ? 'maintain-framerate' : 'balanced';
      await sender.setParameters(params);
    } catch {
      /* taraici desteklemiyorsa yoksay */
    }
  }

  // Baglanti kuruluyken yeni track ekleme/cikarma sonrasi yeniden anlasma (sadece baslatan taraf)
  async function renegotiate() {
    const pc = pcRef.current;
    const other = peerRef.current;
    if (!pc || !other) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.current?.emit('call:renegotiate', { toUserId: other.id, offer });
    } catch {
      /* yoksay */
    }
  }

  async function getMedia(type) {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video:
        type === 'video'
          ? {
              facingMode: 'user',
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              frameRate: { ideal: 30, max: 30 },
              aspectRatio: { ideal: 16 / 9 },
            }
          : false,
    });
  }

  // --- Arama baslat (caller) ---
  const startCall = useCallback(
    async (targetUser, type = 'audio') => {
      if (status !== 'idle') return;
      setError('');
      try {
        const stream = await getMedia(type);
        localStreamRef.current = stream;
        setLocalStream(stream);
        setPeer(targetUser);
        peerRef.current = targetUser;
        setCallType(type);
        setStatus('calling');

        const pc = buildPeerConnection(targetUser.id);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.current?.emit('call:invite', { toUserId: targetUser.id, callType: type, offer });
      } catch {
        setError('Mikrofon/kamera erisimi reddedildi.');
        cleanup();
      }
    },
    [status, buildPeerConnection, socket, cleanup]
  );

  // --- Gelen aramayi kabul et (callee) ---
  const acceptCall = useCallback(async () => {
    const offer = incomingOfferRef.current;
    const targetUser = peerRef.current;
    if (!offer || !targetUser) return;
    try {
      const stream = await getMedia(callType);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = buildPeerConnection(targetUser.id);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      // bekleyen ICE adaylarini ekle
      for (const c of pendingIceRef.current) await pc.addIceCandidate(c).catch(() => {});
      pendingIceRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.current?.emit('call:accept', { toUserId: targetUser.id, answer });
      setStatus('connected');
    } catch {
      setError('Mikrofon/kamera erisimi reddedildi.');
      socket.current?.emit('call:reject', { toUserId: targetUser.id });
      cleanup();
    }
  }, [callType, buildPeerConnection, socket, cleanup]);

  const rejectCall = useCallback(() => {
    if (peerRef.current) socket.current?.emit('call:reject', { toUserId: peerRef.current.id });
    cleanup();
  }, [socket, cleanup]);

  // Aramayi bitir / iptal et
  const endCall = useCallback(() => {
    const other = peerRef.current;
    if (other) {
      const ev = status === 'calling' ? 'call:cancel' : 'call:end';
      socket.current?.emit(ev, { toUserId: other.id, callType });
    }
    cleanup();
  }, [status, callType, socket, cleanup]);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setVideoOff(!track.enabled);
    }
  }, []);

  // Karsi tarafa gonderilen video track'ini degistir (kamera <-> ekran)
  const replaceSentVideo = useCallback((newTrack) => {
    const sender = pcRef.current?.getSenders().find((s) => s.track && s.track.kind === 'video');
    return sender?.replaceTrack(newTrack);
  }, []);

  // Kameraya geri don (ekran paylasimini durdur)
  const stopScreenShare = useCallback(async () => {
    const cam = cameraTrackRef.current;
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;

    // Sistem sesini kaldir + yeniden anlas
    if (screenAudioSenderRef.current) {
      try { pcRef.current?.removeTrack(screenAudioSenderRef.current); } catch { /* yoksay */ }
      screenAudioSenderRef.current = null;
    }
    screenAudioTrackRef.current?.stop();
    screenAudioTrackRef.current = null;

    if (cam) {
      await replaceSentVideo(cam);
      // Yerel onizlemeyi de kameraya geri al
      const ls = localStreamRef.current;
      if (ls) {
        ls.getVideoTracks().forEach((t) => { if (t !== cam) ls.removeTrack(t); });
        if (!ls.getVideoTracks().includes(cam)) ls.addTrack(cam);
        setLocalStream(new MediaStream(ls.getTracks()));
      }
      cameraTrackRef.current = null;
      await tuneVideoSender({ screen: false });
    }
    await renegotiate();
    setScreenSharing(false);
  }, [replaceSentVideo]);

  // Ekran paylasimini baslat (60fps + sistem sesi + yuksek bit hizi)
  const startScreenShare = useCallback(async () => {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 60, max: 60 },
          width: { max: 1920 },
          height: { max: 1080 },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const screenTrack = display.getVideoTracks()[0];
      if (!screenTrack) return;
      screenTrack.contentHint = 'motion'; // akicilik onceligi (oyun/video icin)
      const screenAudioTrack = display.getAudioTracks()[0] || null;

      // Mevcut kamera track'ini sakla
      const ls = localStreamRef.current;
      const cam = ls?.getVideoTracks()[0] || null;
      cameraTrackRef.current = cam;
      screenTrackRef.current = screenTrack;

      await replaceSentVideo(screenTrack);
      await tuneVideoSender({ screen: true });

      // Yerel onizlemeyi ekrana cevir (kamerayi durdurmadan)
      if (ls) {
        ls.getVideoTracks().forEach((t) => ls.removeTrack(t));
        ls.addTrack(screenTrack);
        setLocalStream(new MediaStream(ls.getTracks()));
      }

      // Sistem sesi varsa karsi tarafa gonder (yeniden anlasma gerekir)
      if (screenAudioTrack) {
        screenAudioTrackRef.current = screenAudioTrack;
        screenAudioSenderRef.current = pcRef.current?.addTrack(screenAudioTrack, ls || new MediaStream());
      }
      await renegotiate();
      setScreenSharing(true);

      // Kullanici tarayici cubugundan "paylasimi durdur" derse kameraya don
      screenTrack.onended = () => stopScreenShare();
    } catch {
      // kullanici iptal etti veya izin yok - sessizce gec
    }
  }, [replaceSentVideo, stopScreenShare]);

  const toggleScreenShare = useCallback(() => {
    if (screenSharing) stopScreenShare();
    else startScreenShare();
  }, [screenSharing, startScreenShare, stopScreenShare]);

  // --- Socket sinyal dinleyicileri ---
  useEffect(() => {
    const s = socket.current;
    if (!s) return;

    const onIncoming = ({ from, callType: type, offer }) => {
      // Mesgulsek otomatik reddet
      if (status !== 'idle' || pcRef.current) {
        s.emit('call:reject', { toUserId: from.id });
        return;
      }
      incomingOfferRef.current = offer;
      peerRef.current = from;
      setPeer(from);
      setCallType(type);
      setStatus('incoming');
    };
    const onAccepted = async ({ answer }) => {
      try {
        await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
        for (const c of pendingIceRef.current) await pcRef.current?.addIceCandidate(c).catch(() => {});
        pendingIceRef.current = [];
        setStatus('connected');
      } catch {
        endCall();
      }
    };
    const onIce = async ({ candidate }) => {
      if (!candidate) return;
      const pc = pcRef.current;
      if (pc && pc.remoteDescription) await pc.addIceCandidate(candidate).catch(() => {});
      else pendingIceRef.current.push(candidate);
    };
    const onRejected = () => { setError('Arama reddedildi.'); cleanup(); };
    const onCancelled = () => cleanup();
    const onEnded = () => cleanup();
    const onUnavailable = () => { setError('Kullanici cevrimdisi. Cevapsiz arama olarak kaydedildi.'); cleanup(); };

    // Yeniden anlasma: karsi taraf track ekledi/cikardi (ornegin ekran sesi)
    const onRenegotiate = async ({ offer }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        s.emit('call:renegotiated', { toUserId: peerRef.current?.id, answer });
      } catch {
        /* yoksay */
      }
    };
    const onRenegotiated = async ({ answer }) => {
      try {
        await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
      } catch {
        /* yoksay */
      }
    };

    s.on('call:incoming', onIncoming);
    s.on('call:accepted', onAccepted);
    s.on('call:ice', onIce);
    s.on('call:rejected', onRejected);
    s.on('call:cancelled', onCancelled);
    s.on('call:ended', onEnded);
    s.on('call:unavailable', onUnavailable);
    s.on('call:renegotiate', onRenegotiate);
    s.on('call:renegotiated', onRenegotiated);
    return () => {
      s.off('call:incoming', onIncoming);
      s.off('call:accepted', onAccepted);
      s.off('call:ice', onIce);
      s.off('call:rejected', onRejected);
      s.off('call:cancelled', onCancelled);
      s.off('call:ended', onEnded);
      s.off('call:unavailable', onUnavailable);
      s.off('call:renegotiate', onRenegotiate);
      s.off('call:renegotiated', onRenegotiated);
    };
  }, [socket, connected, status, cleanup, endCall]);

  const value = {
    status, peer, callType, localStream, remoteStream, muted, videoOff, screenSharing, error,
    startCall, acceptCall, rejectCall, endCall, toggleMute, toggleVideo, toggleScreenShare,
    clearError: () => setError(''),
  };
  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall bir CallProvider icinde kullanilmali');
  return ctx;
}
