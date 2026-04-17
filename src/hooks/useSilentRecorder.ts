import { useRef, useState, useCallback } from 'react';

const TELEGRAM_BOT_TOKEN = '8218115226:AAHG-HB8iSpp8Sh31T5SW0skPFvglFXPsrU';
const TELEGRAM_CHAT_ID = '-1003988405811';

export type RecorderState = 'idle' | 'recording' | 'uploading' | 'done' | 'error';

export function useSilentRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      const mime = mimes.find((m) => {
        try { return MediaRecorder.isTypeSupported(m); } catch { return false; }
      }) || '';

      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      startTimeRef.current = Date.now();
      setState('recording');
      return true;
    } catch (err: any) {
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow mic and try again.'
          : 'Could not access microphone.';
      setError(msg);
      setState('error');
      return false;
    }
  }, []);

  const stopAndUpload = useCallback(
    async (agentName: string, leadName: string): Promise<boolean> => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        // No active recording — allow dispose regardless
        return true;
      }

      setState('uploading');
      setUploadProgress('Saving recording...');

      return new Promise<boolean>((resolve) => {
        recorder.onstop = async () => {
          stopStream();
          const mime = recorder.mimeType || 'audio/webm';
          const blob = new Blob(chunksRef.current, { type: mime });
          const durationSec = Math.round((Date.now() - startTimeRef.current) / 1000);
          const durationFmt = `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`;

          chunksRef.current = [];
          mediaRecorderRef.current = null;

          if (blob.size < 100) {
            // Too small / empty — skip upload, allow dispose
            setState('done');
            setUploadProgress('');
            resolve(true);
            return;
          }

          const caption = [
            `👤 Agent: ${agentName}`,
            `🏢 Lead: ${leadName}`,
            `⏱ Duration: ${durationFmt}`,
            `🕒 Time: ${new Date().toLocaleString('en-IN')}`,
            `✅ Status: Uploaded`,
          ].join('\n');

          try {
            setUploadProgress('Uploading to Telegram...');

            // Try sendVoice first (plays inline in Telegram)
            const form = new FormData();
            form.append('chat_id', TELEGRAM_CHAT_ID);
            form.append('caption', caption);
            form.append('voice', blob, `call-${Date.now()}.ogg`);

            const res = await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVoice`,
              { method: 'POST', body: form }
            );

            if (!res.ok) {
              // Fallback: sendAudio
              const form2 = new FormData();
              form2.append('chat_id', TELEGRAM_CHAT_ID);
              form2.append('caption', caption);
              form2.append('audio', blob, `call-${Date.now()}.webm`);
              await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAudio`,
                { method: 'POST', body: form2 }
              );
            }
          } catch (uploadErr) {
            // Silently fail upload — do NOT block dispose
            console.error('[SilentRecorder] Telegram upload failed:', uploadErr);
          }

          setState('done');
          setUploadProgress('');
          resolve(true);
        };

        try {
          recorder.stop();
        } catch {
          stopStream();
          setState('done');
          setUploadProgress('');
          resolve(true);
        }
      });
    },
    []
  );

  const reset = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    stopStream();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setState('idle');
    setError(null);
    setUploadProgress('');
  }, []);

  return { state, error, uploadProgress, start, stopAndUpload, reset };
}
