import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Button, message, Spin, QRCode, Modal } from 'antd';
import { CameraOutlined, QrcodeOutlined, EyeOutlined } from '@ant-design/icons';

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
  const [isMobileView, setIsMobileView] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const animationFrameId = useRef<number | null>(null);

  // Adjusted rectangle guideline dimensions (relative to video frame size)
  const guideline: Rectangle = {
    topLeft: { x: 0.1, y: 0.3 },
    topRight: { x: 0.9, y: 0.3 },
    bottomRight: { x: 0.9, y: 0.7 },
    bottomLeft: { x: 0.1, y: 0.7 }
  };

  useEffect(() => {
    // Detect if the viewport width is less than a certain threshold (e.g., 768px for mobile view)
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 768);
    };

    // Initial check
    handleResize();

    // Add event listener for window resize
    window.addEventListener('resize', handleResize);

    // Cleanup event listener on component unmount
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const sharpenImage = (canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) => {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 4; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Simple sharpening algorithm
      data[i] = r + (r - data[i - 4]) * 0.5;
      data[i + 1] = g + (g - data[i - 3]) * 0.5;
      data[i + 2] = b + (b - data[i - 2]) * 0.5;
    }

    context.putImageData(imageData, 0, 0);
  };

  const startCamera = useCallback(async () => {
    try {
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 }, // Request high resolution
          height: { ideal: 720 },
          focusMode: 'continuous' // Enable auto-focus if supported
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

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

      // Apply sharpening
      sharpenImage(canvas, context);

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

        // Save the base64 image to state
        setCapturedImage(base64Image);

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

  const showPreview = () => {
    setIsPreviewVisible(true);
  };

  const hidePreview = () => {
    setIsPreviewVisible(false);
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

      {isMobileView ? (
        <>
          <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden mb-4" style={{ height: '80vh' }}>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              playsInline
              style={{ width: '100%', height: '100%' }} // Adjust video size
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
                {capturedImage && (
                  <Button
                    type="primary"
                    icon={<EyeOutlined />}
                    size="large"
                    onClick={showPreview}
                    className="bg-purple-500"
                  >
                    Preview Image
                  </Button>
                )}
              </>
            )}
          </div>

          <Modal
            visible={isPreviewVisible}
            onCancel={hidePreview}
            footer={null}
            centered
          >
            <img src={capturedImage || ''} alt="Captured ID" style={{ width: '100%' }} />
          </Modal>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center p-4">
          <QRCode
            value="https://example.com/id-card-scanner" // Replace with your actual URL
            size={200}
            icon={<QrcodeOutlined />}
          />
          <p className="mt-4 text-center">Scan this QR code with your mobile device to use the ID Card Scanner.</p>
        </div>
      )}
    </div>
  );
};

export default IDCardScanner;
