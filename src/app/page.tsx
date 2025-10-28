'use client';

import { useState } from 'react';
import Image from 'next/image';
import { createWorker } from 'tesseract.js';

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
      setExtractedText('');
      setError('');
      setProgress(0);
    }
  };

  const handleExtractText = async () => {
    if (!selectedImage) return;

    setIsLoading(true);
    setError('');
    setExtractedText('');
    setProgress(0);

    // コンソール警告を一時的に抑制
    const originalWarn = console.warn;
    console.warn = (...args) => {
      const message = args[0]?.toString() || '';
      // Tesseractのパラメータ警告のみをフィルタリング
      if (!message.includes('Parameter not found:')) {
        originalWarn.apply(console, args);
      }
    };

    try {
      // Tesseract.js Workerを作成
      const worker = await createWorker('jpn+eng', 1, {
        logger: (m) => {
          // プログレス情報のみを処理
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      // OCR処理を実行
      const { data: { text } } = await worker.recognize(selectedImage);

      // Workerを終了
      await worker.terminate();

      setExtractedText(text.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      // コンソール警告を元に戻す
      console.warn = originalWarn;
      setIsLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen p-8 pb-20 sm:p-20 font-sans">
      <main className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8">
          画像から文字を抽出 (OCR)
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="mb-6">
            <label
              htmlFor="image-upload"
              className="block text-sm font-medium mb-2"
            >
              画像を選択してください
            </label>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300"
            />
          </div>

          {selectedImage && (
            <div className="mb-6">
              <div className="relative w-full max-w-2xl mx-auto border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                <Image
                  src={selectedImage}
                  alt="選択された画像"
                  width={800}
                  height={600}
                  className="w-full h-auto"
                  unoptimized
                />
              </div>
            </div>
          )}

          <button
            onClick={handleExtractText}
            disabled={!selectedImage || isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {isLoading ? '処理中...' : '文字を抽出'}
          </button>

          {isLoading && progress > 0 && (
            <div className="mt-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">処理中</span>
                <span className="text-sm font-medium">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">エラー</p>
            <p>{error}</p>
          </div>
        )}

        {extractedText && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">抽出されたテキスト</h2>
            <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
              {extractedText}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
