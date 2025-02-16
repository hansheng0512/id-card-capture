import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Button, message, Spin } from 'antd';
import { CameraOutlined } from '@ant-design/icons';

interface Point {
  x: number;
  y: number;
}

interface Rectangle {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

const IDCardScanner: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const animationFrameId = useRef<number | null>(null);

  // Rectangle guideline dimensions (relative to video frame size)
  const guideline: Rectangle = {
    topLeft: { x: 0.2, y: 0.2 },
    topRight: { x: 0.8, y: 0.2 },
    bottomRight: { x: 0.8, y: 0.8 },
    bottomLeft: { x: 0.2, y: 0.8 }
  };

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCapturing(true);

        // Wait for the video to start playing
        videoRef.current.onloadedmetadata = () => {
          drawGuideline();
        };
      }
    } catch (err) {
      message.error('Failed to access camera. Please check permissions.');
      console.error('Error accessing camera:', err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCapturing(false);
    }
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
  }, []);

  const captureImage = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      setIsProcessing(true);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
        message.error('Canvas context not available');
        setIsProcessing(false);
        return;
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw the current frame from video to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Calculate guideline rectangle in actual pixel coordinates
      const actualGuideline: Rectangle = {
        topLeft: {
          x: guideline.topLeft.x * canvas.width,
          y: guideline.topLeft.y * canvas.height
        },
        topRight: {
          x: guideline.topRight.x * canvas.width,
          y: guideline.topRight.y * canvas.height
        },
        bottomRight: {
          x: guideline.bottomRight.x * canvas.width,
          y: guideline.bottomRight.y * canvas.height
        },
        bottomLeft: {
          x: guideline.bottomLeft.x * canvas.width,
          y: guideline.bottomLeft.y * canvas.height
        }
      };

      // Crop the image to the guideline rectangle
      const width = actualGuideline.topRight.x - actualGuideline.topLeft.x;
      const height = actualGuideline.bottomLeft.y - actualGuideline.topLeft.y;

      const croppedImageData = context.getImageData(
        actualGuideline.topLeft.x,
        actualGuideline.topLeft.y,
        width,
        height
      );

      // Create a new canvas for the cropped image
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = width;
      croppedCanvas.height = height;
      const croppedContext = croppedCanvas.getContext('2d');

      if (croppedContext) {
        croppedContext.putImageData(croppedImageData, 0, 0);

        // Convert to base64
        const base64Image = croppedCanvas.toDataURL('image/png');

        // Send to backend
        sendToBackend(base64Image);
      }
    }
  }, [guideline]);

  const sendToBackend = async (base64Image: string) => {
    try {
      console.log(base64Image);

      // Mock API call - replace with your actual API endpoint
      // const response = await fetch('/api/upload-id-card', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ image: base64Image }),
      // });

      // if (!response.ok) throw new Error('Failed to upload image');

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      message.success('ID card successfully captured and sent');
      stopCamera();
    } catch (error) {
      message.error('Failed to send image to server');
      console.error('Error sending image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Draw guideline on video
  const drawGuideline = useCallback(() => {
    if (!isCapturing || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || !video.videoWidth) {
      animationFrameId.current = requestAnimationFrame(drawGuideline);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.clearRect(0, 0, canvas.width, canvas.height);

    // Draw semi-transparent overlay
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate guideline rectangle in actual pixel coordinates
    const actualGuideline: Rectangle = {
      topLeft: {
        x: guideline.topLeft.x * canvas.width,
        y: guideline.topLeft.y * canvas.height
      },
      topRight: {
        x: guideline.topRight.x * canvas.width,
        y: guideline.topRight.y * canvas.height
      },
      bottomRight: {
        x: guideline.bottomRight.x * canvas.width,
        y: guideline.bottomRight.y * canvas.height
      },
      bottomLeft: {
        x: guideline.bottomLeft.x * canvas.width,
        y: guideline.bottomLeft.y * canvas.height
      }
    };

    // Clear the rectangle guideline area
    context.clearRect(
      actualGuideline.topLeft.x,
      actualGuideline.topLeft.y,
      actualGuideline.topRight.x - actualGuideline.topLeft.x,
      actualGuideline.bottomLeft.y - actualGuideline.topLeft.y
    );

    // Draw rectangle outline
    context.strokeStyle = '#00BFFF';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(actualGuideline.topLeft.x, actualGuideline.topLeft.y);
    context.lineTo(actualGuideline.topRight.x, actualGuideline.topRight.y);
    context.lineTo(actualGuideline.bottomRight.x, actualGuideline.bottomRight.y);
    context.lineTo(actualGuideline.bottomLeft.x, actualGuideline.bottomLeft.y);
    context.closePath();
    context.stroke();

    // Add corner markers
    const corners = [
      actualGuideline.topLeft,
      actualGuideline.topRight,
      actualGuideline.bottomRight,
      actualGuideline.bottomLeft
    ];

    context.fillStyle = '#00BFFF';
    corners.forEach(corner => {
      context.beginPath();
      context.arc(corner.x, corner.y, 10, 0, 2 * Math.PI);
      context.fill();
    });

    // Add text instruction
    context.fillStyle = 'white';
    context.font = 'bold 24px Arial';
    context.textAlign = 'center';
    context.fillText(
      'Position ID card within the rectangle',
      canvas.width / 2,
      actualGuideline.topLeft.y - 20
    );

    animationFrameId.current = requestAnimationFrame(drawGuideline);
  }, [isCapturing, guideline]);

  // Draw guideline when video metadata is loaded
  useEffect(() => {
    if (isCapturing) {
      drawGuideline();
    }
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, [isCapturing, drawGuideline]);

  // Clean up on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return (
    <div className="flex flex-col items-center justify-center p-4 w-full max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">ID Card Scanner</h1>

      <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden mb-4">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <Spin size="large" tip="Processing..." />
          </div>
        )}
      </div>

      <div className="w-full flex justify-center gap-4">
        {!isCapturing ? (
          <Button
            type="primary"
            icon={<CameraOutlined />}
            size="large"
            onClick={startCamera}
            className="bg-blue-500"
          >
            Start Camera
          </Button>
        ) : (
          <>
            <Button
              type="primary"
              danger
              size="large"
              onClick={stopCamera}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              icon={<CameraOutlined />}
              size="large"
              onClick={captureImage}
              disabled={isProcessing}
              className="bg-green-500"
            >
              Capture ID Card
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default IDCardScanner;
