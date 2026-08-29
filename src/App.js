import React, { useEffect, useState, useRef, useCallback } from "react";
import styled from "styled-components";
import Camera from "./Sections/Camera";
import ColorSpectrum from "./Sections/ColorSpectrum";
import Description from "./Sections/Description";
import Emoji from "./Sections/Emoji";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";

const getApiKey = () => {
  const urlApiKey = new URLSearchParams(window.location.search).get(
    "anthropicApiKey"
  );
  if (urlApiKey) {
    localStorage.setItem("anthropicApiKey", urlApiKey);
    return urlApiKey;
  }
  return localStorage.getItem("anthropicApiKey") || "";
};

const isAlignmentMode = () => {
  return (
    new URLSearchParams(window.location.search).get("alignmentMode") === "true"
  );
};

let anthropicApiKey = getApiKey();

const Observation = z.object({
  emoji: z.string(),
  description: z.string()
});

// Doubles as the request's output_config.format (the parse function is dropped
// by JSON.stringify) and as the validator for the JSON Claude sends back.
const observationFormat = zodOutputFormat(Observation);

const Page = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: ${(props) =>
    props.$alignmentMode ? "#ffffff" : "#000000"};
`;

const Section = styled.div`
  position: absolute;
  border-radius: 32px;
  overflow: hidden;
  cursor: pointer;
  transition: opacity 0.2s ease;
  opacity: ${(props) => (props.$isPaused ? 0.25 : 1)};
  background-color: #000000;
  -webkit-tap-highlight-color: transparent;
`;

const TopSection = styled(Section)`
  top: 2px;
  left: 8px;
  width: 396px;
  height: 320px;
  background-color: ${(props) => props.$alignmentMode && "#ff6b6b"};
`;

const MiddleSection = styled(Section)`
  top: 402px;
  left: 8px;
  width: 396px;
  height: 188px;
  background-color: ${(props) => props.$alignmentMode && "#4ecdc4"};
`;

const BottomLeftSection = styled(Section)`
  top: 668px;
  left: 8px;
  width: 154px;
  height: 156px;
  padding-bottom: 8px;
  background-color: ${(props) => props.$alignmentMode && "#45b7d1"};
`;

const BottomRightSection = styled(Section)`
  top: 670px;
  left: 250px;
  width: 154px;
  height: 156px;
  padding-bottom: 8px;
  background-color: ${(props) => props.$alignmentMode && "#45b7d1"};
`;

const PlayButton = styled.div`
  position: absolute;
  top: 127px;
  left: 167px;
  width: 80px;
  height: 80px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  backdrop-filter: blur(5px);
  border: 2px solid rgba(255, 255, 255, 0.5);
  transition: all 0.3s ease;

  &:active {
    transform: scale(0.9);
  }
`;

const PlayButtonIcon = styled.div`
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 16px 0 16px 28px;
  border-color: transparent transparent transparent #ffffff;
  margin-left: 6px;
`;

function App() {
  const [videoStream, setVideoStream] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentEmoji, setCurrentEmoji] = useState(null);
  const [currentDescription, setCurrentDescription] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [alignmentMode] = useState(isAlignmentMode());
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const isPausedRef = useRef(false);

  useEffect(() => {
    if (!anthropicApiKey) {
      const apiKey = prompt("Please enter your Anthropic API key:");
      if (apiKey) {
        anthropicApiKey = apiKey.trim();
        localStorage.setItem("anthropicApiKey", anthropicApiKey);
      }
    }
  }, []);

  const captureAndAnalyze = useCallback(async () => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      isProcessing ||
      isPausedRef.current ||
      !anthropicApiKey
    ) {
      return;
    }

    try {
      setIsProcessing(true);

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      canvas.width = 256;
      canvas.height = 256;

      ctx.drawImage(videoRef.current, 0, 0, 256, 256);

      const imageData = canvas.toDataURL("image/jpeg", 0.9).split(",")[1];

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-opus-5",
          max_tokens: 2048,
          output_config: {
            effort: "low",
            format: observationFormat
          },
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: imageData
                  }
                },
                {
                  type: "text",
                  text: "Look at this image and respond with a single emoji that best represents what you see and a short description of what you see (in the style of a observing radio transmission, max 10 words, with no trailing period)"
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Claude API error: ${response.status} - ${JSON.stringify(errorData)}`
        );
      }

      const data = await response.json();
      const textBlock = data.content?.find((block) => block.type === "text");
      const parsedResponse = observationFormat.parse(textBlock?.text ?? "");
      const emoji = parsedResponse.emoji;
      const description = parsedResponse.description;

      if (!isPausedRef.current) {
        if (emoji) {
          setCurrentEmoji(emoji);
          setCurrentDescription(description);
        }
      }
    } catch (err) {
      console.error("Error analyzing image:", err);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing]);

  const handlePauseToggle = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (isPaused) {
      timeoutRef.current = setTimeout(captureAndAnalyze, 500);
      intervalRef.current = setInterval(captureAndAnalyze, 5000);
    }
    setIsPaused(!isPaused);
    isPausedRef.current = !isPaused;
  }, [isPaused, captureAndAnalyze]);

  useEffect(() => {
    // Don't start camera if in alignment mode
    if (alignmentMode) {
      setLoading(false);
      return;
    }

    let stream = null;
    let mounted = true;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 640,
            height: 480,
            facingMode: "environment"
          },
          audio: false
        });

        if (mounted) {
          setVideoStream(stream);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        if (mounted) {
          setError(`Camera error: ${err.message}`);
          setLoading(false);
        }
      }
    };

    startCamera();

    return () => {
      mounted = false;
      if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, [alignmentMode]);

  useEffect(() => {
    if (!videoStream) return;

    const setupVideo = async () => {
      if (videoRef.current) {
        try {
          videoRef.current.srcObject = videoStream;
          await videoRef.current.play();
        } catch (err) {
          console.error("Error playing video:", err);
          setCurrentEmoji(null);
          setCurrentDescription(null);
        }
      }
    };

    const videoElement = videoRef.current;
    setupVideo();

    intervalRef.current = setInterval(captureAndAnalyze, 5000);
    timeoutRef.current = setTimeout(captureAndAnalyze, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [videoStream, captureAndAnalyze]);

  useEffect(() => {
    if (videoRef.current && videoStream) {
      if (isPaused) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(console.error);
      }
    }
  }, [isPaused, videoStream]);

  return (
    <Page $alignmentMode={alignmentMode}>
      <TopSection
        $alignmentMode={alignmentMode}
        $isPaused={isPaused}
        onClick={handlePauseToggle}
      >
        {!alignmentMode && (
          <Camera
            videoStream={videoStream}
            error={error}
            loading={loading}
            isPaused={isPaused}
            onToggle={handlePauseToggle}
          />
        )}
      </TopSection>
      <MiddleSection
        $alignmentMode={alignmentMode}
        $isPaused={isPaused}
        onClick={handlePauseToggle}
      >
        {!alignmentMode && (
          <ColorSpectrum
            videoStream={videoStream}
            error={error}
            loading={loading}
            isPaused={isPaused}
          />
        )}
      </MiddleSection>
      <BottomLeftSection
        $alignmentMode={alignmentMode}
        $isPaused={isPaused}
        onClick={handlePauseToggle}
      >
        {!alignmentMode && <Description description={currentDescription} />}
      </BottomLeftSection>
      <BottomRightSection
        $alignmentMode={alignmentMode}
        $isPaused={isPaused}
        onClick={handlePauseToggle}
      >
        {!alignmentMode && <Emoji emoji={currentEmoji} />}
      </BottomRightSection>
      {!alignmentMode && isPaused && !loading && !error && (
        <PlayButton onClick={handlePauseToggle}>
          <PlayButtonIcon />
        </PlayButton>
      )}
      {!alignmentMode && (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              position: "absolute",
              top: "-1000px",
              left: "-1000px",
              width: "224px",
              height: "224px"
            }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              top: "-1000px",
              left: "-1000px",
              width: "256px",
              height: "256px"
            }}
          />
        </>
      )}
    </Page>
  );
}

export default App;
