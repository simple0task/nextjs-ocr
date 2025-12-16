'use client';

import { useState } from 'react';

interface Entity {
  type: string;
  mentionText: string;
  confidence: number;
  normalizedValue: string;
  pageAnchor: number;
}

interface FormField {
  fieldName: string;
  fieldValue: string;
  confidence: number;
}

interface Table {
  headerRows: string[][];
  bodyRows: string[][];
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setExtractedText('');
      setEntities([]);
      setFormFields([]);
      setTables([]);
      setError('');
    }
  };

  const handleProcessDocument = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError('');
    setExtractedText('');
    setEntities([]);
    setFormFields([]);
    setTables([]);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/document-ai', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Document AI処理に失敗しました');
      }

      setExtractedText(data.text);
      setEntities(data.entities || []);
      setFormFields(data.formFields || []);
      setTables(data.tables || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 pb-20 sm:p-20 font-sans">
      <main className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold">
            Google Document AI - Form Parser
          </h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="mb-6">
            <label
              htmlFor="file-upload"
              className="block text-sm font-medium mb-2"
            >
              請求書・領収書・フォームファイルを選択してください (PDF, 画像)
            </label>
            <input
              id="file-upload"
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300"
            />
          </div>

          {selectedFile && (
            <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
              <p className="text-sm">
                <span className="font-semibold">選択されたファイル:</span>{' '}
                {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
              </p>
            </div>
          )}

          <button
            onClick={handleProcessDocument}
            disabled={!selectedFile || isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {isLoading ? '処理中...' : 'Document AIで解析'}
          </button>
        </div>

        {error && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">エラー</p>
            <p>{error}</p>
          </div>
        )}

        {formFields.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4">フォームフィールド</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left py-2 px-4">フィールド名</th>
                    <th className="text-left py-2 px-4">値</th>
                    <th className="text-right py-2 px-4">信頼度</th>
                  </tr>
                </thead>
                <tbody>
                  {formFields.map((field, index) => (
                    <tr
                      key={index}
                      className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"
                    >
                      <td className="py-2 px-4 font-medium">{field.fieldName}</td>
                      <td className="py-2 px-4">{field.fieldValue}</td>
                      <td className="py-2 px-4 text-right">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs ${
                            field.confidence > 0.9
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : field.confidence > 0.7
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}
                        >
                          {(field.confidence * 100).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tables.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4">抽出されたテーブル</h2>
            {tables.map((table, tableIndex) => (
              <div key={tableIndex} className="mb-6 overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-300 dark:border-gray-700">
                  {table.headerRows.length > 0 && (
                    <thead className="bg-gray-100 dark:bg-gray-900">
                      {table.headerRows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <th
                              key={cellIndex}
                              className="border border-gray-300 dark:border-gray-700 py-2 px-4 text-left font-semibold"
                            >
                              {cell}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                  )}
                  <tbody>
                    {table.bodyRows.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className={rowIndex % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'}
                      >
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="border border-gray-300 dark:border-gray-700 py-2 px-4"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {entities.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4">抽出されたエンティティ</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left py-2 px-4">タイプ</th>
                    <th className="text-left py-2 px-4">値</th>
                    <th className="text-left py-2 px-4">正規化値</th>
                    <th className="text-right py-2 px-4">信頼度</th>
                  </tr>
                </thead>
                <tbody>
                  {entities.map((entity, index) => (
                    <tr
                      key={index}
                      className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"
                    >
                      <td className="py-2 px-4 font-medium">{entity.type}</td>
                      <td className="py-2 px-4">{entity.mentionText}</td>
                      <td className="py-2 px-4 text-gray-600 dark:text-gray-400">
                        {entity.normalizedValue || '-'}
                      </td>
                      <td className="py-2 px-4 text-right">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs ${
                            entity.confidence > 0.9
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : entity.confidence > 0.7
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}
                        >
                          {(entity.confidence * 100).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
