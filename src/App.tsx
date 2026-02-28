import { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/genai';
import { Upload, Image as ImageIcon, Copy, Check, Loader2, Trash2 } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';

// Forzamos a que sea un string y eliminamos posibles espacios invisibles
const apiKey = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();

if (!apiKey) {
  console.error("La API Key está vacía o mal configurada en Vercel");
}

// Inicialización con el nombre de clase correcto
const genAI = new GoogleGenerativeAI(apiKey);
const ai = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [latex, setLatex] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
  };

  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) processFile(file);
          break;
        }
      }
    }
  };

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, []);

  const processFile = (file: File) => {
    setError(null);
    setLatex('');
    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const extractLatex = async () => {
    if (!image) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const base64Data = image.split(',')[1];
      const mimeType = image.split(';')[0].split(':')[1];

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: "Act as an expert Mathematics OCR. Analyze the provided image of a mathematical equation and convert it into a clean, accurate LaTeX string. Return only the plain text LaTeX code without any additional explanations, markdown formatting, or preamble.",
            },
          ],
        },
      });

      let result = response.text || '';
      
      // Clean up any potential markdown formatting if the model still includes it
      if (result.startsWith('```latex')) {
        result = result.replace(/^```latex\n?/, '').replace(/\n?```$/, '');
      } else if (result.startsWith('```')) {
        result = result.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      
      setLatex(result.trim());
    } catch (err: any) {
      console.error('Error extracting LaTeX:', err);
      setError(err.message || 'Failed to extract LaTeX from image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = () => {
    if (!latex) return;
    navigator.clipboard.writeText(latex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearImage = () => {
    setImage(null);
    setLatex('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="text-center space-y-2 py-8">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Math OCR</h1>
          <p className="text-zinc-500 text-lg">Convert images of mathematical equations into clean LaTeX</p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Image Input */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-800">Input Image</h2>
              {image && (
                <button
                  onClick={clearImage}
                  className="text-sm text-zinc-500 hover:text-red-500 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear
                </button>
              )}
            </div>
            
            {!image ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-300 rounded-2xl aspect-video flex flex-col items-center justify-center p-6 cursor-pointer hover:bg-zinc-100 hover:border-zinc-400 transition-all text-center space-y-4 bg-white"
              >
                <div className="w-14 h-14 bg-zinc-50 rounded-full shadow-sm flex items-center justify-center text-zinc-400 border border-zinc-100">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-medium text-zinc-700">Click to upload or drag and drop</p>
                  <p className="text-sm text-zinc-500 mt-1">You can also paste an image from clipboard</p>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            ) : (
              <div className="relative border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-sm aspect-video flex items-center justify-center p-2 group">
                <img src={image} alt="Uploaded math equation" className="max-w-full max-h-full object-contain" />
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-white rounded-lg shadow-sm text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    Replace Image
                  </button>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            )}

            <button
              onClick={extractLatex}
              disabled={!image || isProcessing}
              className="w-full py-3.5 px-4 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ImageIcon className="w-5 h-5" />
                  Convert to LaTeX
                </>
              )}
            </button>

            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                {error}
              </div>
            )}
          </div>

          {/* Right Column: Output */}
          <div className="space-y-4 flex flex-col">
            <h2 className="text-lg font-semibold text-zinc-800">LaTeX Output</h2>
            
            <div className="border border-zinc-200 rounded-2xl bg-white shadow-sm overflow-hidden flex flex-col flex-1 min-h-[400px]">
              {/* LaTeX Code Area */}
              <div className="relative flex-1 p-4 bg-zinc-50 border-b border-zinc-200 min-h-[150px]">
                {latex ? (
                  <textarea
                    value={latex}
                    onChange={(e) => setLatex(e.target.value)}
                    className="w-full h-full bg-transparent resize-none outline-none font-mono text-sm text-zinc-700"
                    placeholder="LaTeX code will appear here..."
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm font-mono">
                    No LaTeX generated yet
                  </div>
                )}
                
                {latex && (
                  <button
                    onClick={copyToClipboard}
                    className="absolute top-4 right-4 p-2 bg-white border border-zinc-200 rounded-lg shadow-sm hover:bg-zinc-50 transition-colors text-zinc-600"
                    title="Copy to clipboard"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {/* Rendered Preview Area */}
              <div className="flex-1 p-6 flex flex-col items-center justify-center overflow-auto bg-white min-h-[150px]">
                {latex ? (
                  <div className="text-lg w-full overflow-x-auto py-4 px-2">
                    <BlockMath math={latex} errorColor={'#ef4444'} />
                  </div>
                ) : (
                  <div className="text-zinc-400 text-sm flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-zinc-50 flex items-center justify-center border border-zinc-100">
                      <span className="font-serif italic text-xl text-zinc-300">x²</span>
                    </div>
                    Preview will appear here
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
