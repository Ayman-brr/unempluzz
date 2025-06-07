import React, { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import Draggable from 'react-draggable';
import { Upload, Play, Square, Type, Download, RotateCw, Text as TextIcon, AlignLeft, AlignCenter, AlignRight, ChevronDown, ChevronUp } from 'lucide-react';

function App() {
  const [video, setVideo] = useState<File | null>(null);
  const [ffmpeg, setFFmpeg] = useState<FFmpeg | null>(null);
  const [text, setText] = useState('');
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [fontSize, setFontSize] = useState(24);
  const [aspectRatio, setAspectRatio] = useState('16/9');
  const [boxWidth, setBoxWidth] = useState(300);
  const [boxHeight, setBoxHeight] = useState(100);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [showPrompts, setShowPrompts] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getTextSegments = () => {
    return text.split('\n..\n').filter(segment => segment.trim());
  };

  useEffect(() => {
    const loadFFmpeg = async () => {
      const ffmpegInstance = new FFmpeg();
      await ffmpegInstance.load({
        coreURL: await toBlobURL('/ffmpeg-core.js', 'text/javascript'),
        wasmURL: await toBlobURL('/ffmpeg-core.wasm', 'application/wasm'),
      });
      setFFmpeg(ffmpegInstance);
    };
    loadFFmpeg();
  }, []);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideo(e.target.files[0]);
      const url = URL.createObjectURL(e.target.files[0]);
      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            const videoAspect = videoRef.current.videoWidth / videoRef.current.videoHeight;
            setAspectRatio(`${videoAspect}`);
          }
        };
      }
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const exportVideo = async () => {
    if (!ffmpeg || !video || !canvasRef.current) return;
    
    setProcessing(true);
    try {
      const segments = getTextSegments();
      let index = 0;
      
      for (const segment of segments) {
        await ffmpeg.writeFile('input.mp4', await fetchFile(video));
        
        const textContent = `drawtext=text='${segment}':x=${textPosition.x}:y=${textPosition.y}:fontsize=${fontSize}:fontcolor=white:bordercolor=black:borderw=2:fontfile=/font.ttf:rotate=${rotation}`;
        await ffmpeg.writeFile('text.txt', textContent);

        await ffmpeg.exec([
          '-i', 'input.mp4',
          '-vf', `${textContent}`,
          '-c:a', 'copy',
          `output_${index}.mp4`
        ]);

        const data = await ffmpeg.readFile(`output_${index}.mp4`);
        const blob = new Blob([data], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `edited-video-${index + 1}.mp4`;
        a.click();
        
        index++;
      }
    } catch (error) {
      console.error('Error during video processing:', error);
    } finally {
      setProcessing(false);
    }
  };

  const segments = getTextSegments();

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Web Video Editor</h1>
        
        <div className="relative bg-gray-800 rounded-lg p-4 mb-8">
          <div 
            className="relative bg-black rounded-lg overflow-hidden"
            style={{ aspectRatio }}
          >
            <video
              ref={videoRef}
              className="w-full h-full"
              onClick={togglePlay}
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {video && (
              <Draggable
                onDrag={(e, data) => setTextPosition({ x: data.x, y: data.y })}
                bounds="parent"
              >
                <div
                  className="absolute cursor-move"
                  style={{
                    left: textPosition.x,
                    top: textPosition.y,
                    transform: `rotate(${rotation}deg)`,
                    width: `${boxWidth}px`,
                    height: `${boxHeight}px`,
                    border: '2px dashed rgba(255, 255, 255, 0.5)',
                    padding: '8px',
                  }}
                >
                  <div
                    style={{
                      fontSize: `${fontSize}px`,
                      fontFamily: 'Roboto, sans-serif',
                      textAlign,
                      width: '100%',
                      height: '100%',
                      color: 'white',
                      textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000',
                      wordWrap: 'break-word',
                      overflow: 'hidden',
                    }}
                  >
                    {segments[0] || 'Drag me!'}
                  </div>
                </div>
              </Draggable>
            )}
          </div>

          <div className="flex justify-center gap-4 mt-4">
            <label className="btn bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer">
              <Upload size={20} />
              Upload Video
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="hidden"
              />
            </label>

            {video && (
              <>
                <button
                  onClick={togglePlay}
                  className="btn bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  {isPlaying ? <Square size={20} /> : <Play size={20} />}
                  {isPlaying ? 'Pause' : 'Play'}
                </button>

                <button
                  onClick={exportVideo}
                  disabled={processing}
                  className="btn bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Download size={20} />
                  {processing ? 'Processing...' : `Export (${segments.length} videos)`}
                </button>
              </>
            )}
          </div>
        </div>

        {video && (
          <div className="bg-gray-800 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Type size={20} />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text overlay (use .. on a new line to create multiple videos)"
                className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg font-['Roboto'] min-h-[100px]"
              />
            </div>

            {segments.length > 1 && (
              <div className="bg-gray-700 rounded-lg p-4">
                <button
                  onClick={() => setShowPrompts(!showPrompts)}
                  className="flex items-center gap-2 w-full justify-between text-left"
                >
                  <span>Video Prompts ({segments.length})</span>
                  {showPrompts ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                {showPrompts && (
                  <div className="mt-4 space-y-2">
                    {segments.map((segment, index) => (
                      <div key={index} className="bg-gray-800 p-2 rounded">
                        {index + 1}. {segment}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <RotateCw size={20} />
                <input
                  type="number"
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  placeholder="Rotation (degrees)"
                  className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg"
                  min="0"
                  max="360"
                />
              </div>

              <div className="flex items-center gap-2">
                <TextIcon size={20} />
                <input
                  type="number"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  placeholder="Font size (px)"
                  className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg"
                  min="8"
                  max="200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <span>Width:</span>
                <input
                  type="number"
                  value={boxWidth}
                  onChange={(e) => setBoxWidth(Number(e.target.value))}
                  className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg"
                  min="50"
                  max="1000"
                />
              </div>

              <div className="flex items-center gap-2">
                <span>Height:</span>
                <input
                  type="number"
                  value={boxHeight}
                  onChange={(e) => setBoxHeight(Number(e.target.value))}
                  className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg"
                  min="50"
                  max="1000"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 justify-center">
              <button
                onClick={() => setTextAlign('left')}
                className={`p-2 rounded ${textAlign === 'left' ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                <AlignLeft size={20} />
              </button>
              <button
                onClick={() => setTextAlign('center')}
                className={`p-2 rounded ${textAlign === 'center' ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                <AlignCenter size={20} />
              </button>
              <button
                onClick={() => setTextAlign('right')}
                className={`p-2 rounded ${textAlign === 'right' ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                <AlignRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;