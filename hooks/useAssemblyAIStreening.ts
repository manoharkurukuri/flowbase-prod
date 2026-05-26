"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STREAMING_ENDPOINT = "wss://streaming.assemblyai.com/v3/ws";
const TARGET_SAMPLE_RATE = 16000;
const AUDIO_CHUNK_SIZE = Math.round(TARGET_SAMPLE_RATE * 0.05);

export type AssemblyAIStreamingStatus =
  | "idle"
  | "requesting"
  | "connecting"
  | "recording"
  | "stopping"
  | "error";

type AssemblyAIWord = {
  text?: string;
  word_is_final?: boolean;
};

type AssemblyAIStreamingMessage = {
  type?: string;
  turn_order?: number;
  transcript?: string;
  words?: AssemblyAIWord[];
  error?: string;
  message?: string;
};

type UseAssemblyAIStreeningOptions = {
  onFinalTranscript?: (delta: string) => void;
};

type TokenResponse = {
  token?: string;
  error?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getCommonPrefixLength(left: string, right: string) {
  const length = Math.min(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) {
      return index;
    }
  }

  return length;
}

function getStableTranscript(message: AssemblyAIStreamingMessage) {
  const finalWords = Array.isArray(message.words)
    ? message.words
        .filter((word) => word.word_is_final && typeof word.text === "string")
        .map((word) => word.text!.trim())
        .filter(Boolean)
    : [];

  if (finalWords.length > 0) {
    return finalWords.join(" ").trim();
  }

  return typeof message.transcript === "string" ? message.transcript.trim() : "";
}

async function fetchStreamingToken() {
  const response = await fetch("/api/assemblyai/token", {
    method: "POST",
  });
  const data = (await response.json().catch(() => ({}))) as TokenResponse;

  if (!response.ok || !data.token) {
    throw new Error(data.error ?? "AssemblyAI streaming could not start.");
  }

  return data.token;
}

export function useAssemblyAIStreening(options: UseAssemblyAIStreeningOptions = {}) {
  const [status, setStatus] = useState<AssemblyAIStreamingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const insertedByTurnRef = useRef(new Map<number, string>());
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const onFinalTranscriptRef = useRef(options.onFinalTranscript);
  const sessionRef = useRef(0);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const statusRef = useRef<AssemblyAIStreamingStatus>("idle");
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    onFinalTranscriptRef.current = options.onFinalTranscript;
  }, [options.onFinalTranscript]);

  const updateStatus = useCallback((nextStatus: AssemblyAIStreamingStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const cleanupAudio = useCallback(() => {
    workletRef.current?.port.close();
    workletRef.current?.disconnect();
    sourceRef.current?.disconnect();
    gainRef.current?.disconnect();

    workletRef.current = null;
    sourceRef.current = null;
    gainRef.current = null;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;

    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close().catch(() => undefined);
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const cleanupSocket = useCallback((sendTerminate: boolean) => {
    const socket = wsRef.current;
    wsRef.current = null;

    if (!socket) {
      return;
    }

    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;

    if (sendTerminate && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ type: "Terminate" }));
      } catch {
        // The socket is already closing; cleanup can continue.
      }
    }

    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      window.setTimeout(() => {
        try {
          socket.close(1000, "Stopped");
        } catch {
          // Ignore close races during teardown.
        }
      }, sendTerminate ? 120 : 0);
    }
  }, []);

  const cleanupResources = useCallback(
    (sendTerminate: boolean) => {
      cleanupSocket(sendTerminate);
      cleanupAudio();
    },
    [cleanupAudio, cleanupSocket]
  );

  const getTranscriptDelta = useCallback((message: AssemblyAIStreamingMessage) => {
    const transcript = getStableTranscript(message);

    if (!transcript) {
      return "";
    }

    const turnOrder = typeof message.turn_order === "number" ? message.turn_order : 0;
    const previous = insertedByTurnRef.current.get(turnOrder) ?? "";

    if (transcript === previous) {
      return "";
    }

    let delta = "";

    if (!previous) {
      delta = transcript;
    } else if (transcript.startsWith(previous)) {
      delta = transcript.slice(previous.length);
    } else if (transcript.length > previous.length) {
      const prefixLength = getCommonPrefixLength(previous, transcript);
      delta = prefixLength >= previous.length * 0.8 ? transcript.slice(prefixLength) : "";
    }

    insertedByTurnRef.current.set(turnOrder, transcript);
    return delta;
  }, []);

  const stop = useCallback(() => {
    if (statusRef.current === "idle") {
      return;
    }

    sessionRef.current += 1;
    updateStatus("stopping");
    cleanupResources(true);
    insertedByTurnRef.current.clear();
    setLiveTranscript("");
    updateStatus("idle");
  }, [cleanupResources, updateStatus]);

  const start = useCallback(async () => {
    if (statusRef.current !== "idle" && statusRef.current !== "error") {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access is not available in this browser.");
      updateStatus("error");
      return;
    }

    const session = sessionRef.current + 1;
    sessionRef.current = session;
    insertedByTurnRef.current.clear();
    setError(null);
    setLiveTranscript("");
    updateStatus("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      if (sessionRef.current !== session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      mediaStreamRef.current = stream;
      updateStatus("connecting");

      const token = await fetchStreamingToken();

      if (sessionRef.current !== session) {
        cleanupResources(true);
        return;
      }

      const params = new URLSearchParams({
        speech_model: "universal-streaming-english",
        sample_rate: String(TARGET_SAMPLE_RATE),
        encoding: "pcm_s16le",
        token,
      });
      const socket = new WebSocket(`${STREAMING_ENDPOINT}?${params}`);
      socket.binaryType = "arraybuffer";
      wsRef.current = socket;

      socket.onopen = () => {
        void (async () => {
          try {
            if (sessionRef.current !== session) {
              cleanupResources(true);
              return;
            }

            const audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
            audioContextRef.current = audioContext;
            await audioContext.audioWorklet.addModule("/assemblyai-pcm-worklet.js");

            if (sessionRef.current !== session) {
              cleanupResources(true);
              return;
            }

            const source = audioContext.createMediaStreamSource(stream);
            const worklet = new AudioWorkletNode(audioContext, "assemblyai-pcm-processor", {
              processorOptions: {
                chunkSize: AUDIO_CHUNK_SIZE,
                targetSampleRate: TARGET_SAMPLE_RATE,
              },
            });
            const gain = audioContext.createGain();
            gain.gain.value = 0;

            worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
              const activeSocket = wsRef.current;

              if (activeSocket?.readyState === WebSocket.OPEN) {
                activeSocket.send(event.data);
              }
            };

            source.connect(worklet);
            worklet.connect(gain);
            gain.connect(audioContext.destination);

            sourceRef.current = source;
            workletRef.current = worklet;
            gainRef.current = gain;
            updateStatus("recording");
          } catch (caught) {
            if (sessionRef.current !== session) {
              return;
            }

            setError(
              getErrorMessage(caught, "Microphone audio could not be streamed to AssemblyAI.")
            );
            updateStatus("error");
            cleanupResources(true);
          }
        })();
      };

      socket.onmessage = (event: MessageEvent<string>) => {
        if (sessionRef.current !== session) {
          return;
        }

        try {
          const message = JSON.parse(event.data) as AssemblyAIStreamingMessage;

          if (message.type === "Turn") {
            setLiveTranscript(typeof message.transcript === "string" ? message.transcript : "");

            const delta = getTranscriptDelta(message);
            if (delta) {
              onFinalTranscriptRef.current?.(delta);
            }
          }

          if (message.type === "Error") {
            throw new Error(message.error ?? message.message ?? "AssemblyAI streaming failed.");
          }
        } catch (caught) {
          if (caught instanceof SyntaxError) {
            return;
          }

          setError(getErrorMessage(caught, "AssemblyAI streaming failed."));
          updateStatus("error");
          cleanupResources(true);
        }
      };

      socket.onerror = () => {
        if (sessionRef.current !== session) {
          return;
        }

        setError("AssemblyAI streaming connection failed.");
        updateStatus("error");
        cleanupResources(false);
      };

      socket.onclose = (event) => {
        if (sessionRef.current !== session) {
          return;
        }

        cleanupAudio();

        if (statusRef.current !== "stopping" && statusRef.current !== "idle") {
          setError(event.reason || "AssemblyAI streaming connection closed.");
          updateStatus("error");
        }
      };
    } catch (caught) {
      if (sessionRef.current !== session) {
        return;
      }

      setError(getErrorMessage(caught, "Speech-to-text could not start."));
      updateStatus("error");
      cleanupResources(true);
    }
  }, [cleanupAudio, cleanupResources, getTranscriptDelta, updateStatus]);

  useEffect(() => {
    return () => {
      sessionRef.current += 1;
      cleanupResources(true);
    };
  }, [cleanupResources]);

  return {
    error,
    liveTranscript,
    start,
    status,
    stop,
  };
}
