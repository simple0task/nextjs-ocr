'use client';

import { useState } from 'react';

// Custom Extractor用の階層構造エンティティ
interface ExtractedEntity {
  type: string;
  value: string;
  confidence: number;
  normalizedValue: string;
  page: number;
  properties: ExtractedEntity[];
}

// ヘッダーフィールドのタイプ
const HEADER_FIELDS = ['address', 'name', 'delivery_phone_number', 'order_date', 'order_number'];

// 明細テーブルのカラム定義
const ITEM_COLUMNS = [
  { key: 'jan_code', label: 'JANコード', align: 'left' },
  { key: 'product_code', label: 'コード', align: 'left' },
  { key: 'product_name', label: '品名・規格', align: 'left' },
  { key: 'quantity_per_case', label: '入数', align: 'right' },
  { key: 'box_count', label: 'BOX数', align: 'right' },
  { key: 'case_count', label: 'ケース', align: 'right' },
  { key: 'quantity', label: '数量', align: 'right' },
  { key: 'unit_price', label: '単価', align: 'right' },
  { key: 'amount', label: '金額', align: 'right' },
  { key: 'delivery_date', label: '納期/備考', align: 'left' },
] as const;

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [entities, setEntities] = useState<ExtractedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setEntities([]);
      setError('');
    }
  };

  const handleProcessDocument = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError('');
    setEntities([]);

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

      setEntities(data.entities || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  // JSONからヘッダー情報を抽出（トップレベル）
  const headerEntities = entities.filter(e => HEADER_FIELDS.includes(e.type));

  // JSONからrecipient_companyを抽出し、そのpropertiesからname, addressを取得
  const recipientCompany = entities.find(e => e.type === 'recipient_company');
  const recipientProperties = recipientCompany?.properties.filter(p =>
    ['name', 'address'].includes(p.type)
  ) || [];

  // ヘッダー情報とrecipient_companyのpropertiesを結合
  const allHeaderEntities = [...headerEntities, ...recipientProperties];

  // JSONから明細行（items）を抽出
  const itemEntities = entities.filter(e => e.type === 'item');

  // itemのpropertiesから値を取得するヘルパー
  const getPropertyValue = (item: ExtractedEntity, key: string): string => {
    const prop = item.properties.find(p => p.type === key);
    return prop?.value || prop?.normalizedValue || '-';
  };

  // CSVダウンロード処理
  const handleDownloadCsv = () => {
    if (itemEntities.length === 0) return;

    // BOM付きUTF-8でExcelでも文字化けしないようにする
    const BOM = '\uFEFF';

    // ヘッダー行
    const headers = ITEM_COLUMNS.map(col => col.label);

    // データ行
    const rows = itemEntities.map(item =>
      ITEM_COLUMNS.map(col => {
        const value = getPropertyValue(item, col.key);
        // カンマや改行を含む場合はダブルクォートで囲む
        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
    );

    // CSV文字列を作成
    const csvContent = BOM + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

    // ダウンロード
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `明細一覧_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen p-8 pb-20 sm:p-20 font-sans">
      <main className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold">
            Fuji Grace 注文書読み取りデモ
          </h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="mb-6">
            <label
              htmlFor="file-upload"
              className="block text-sm font-medium mb-2"
            >
              注文書を選択してください (PDF)
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
            {isLoading ? '処理中...' : 'Google Document AIで解析'}
          </button>
        </div>

        {error && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">エラー</p>
            <p>{error}</p>
          </div>
        )}

        {entities.length > 0 && (
          <>
            {/* ヘッダー情報（JSONから動的生成） */}
            {allHeaderEntities.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                <h2 className="text-2xl font-semibold mb-4">注文書情報</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allHeaderEntities.map((entity, index) => (
                    <div key={index} className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {entity.type}
                      </div>
                      <div className="font-medium whitespace-pre-line">
                        {entity.value || entity.normalizedValue || '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 明細テーブル（JSONから動的生成） */}
            {itemEntities.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-semibold">明細一覧（{itemEntities.length}件）</h2>
                  <button
                    onClick={handleDownloadCsv}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                  >
                    CSVダウンロード
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse border border-gray-300 dark:border-gray-700">
                    <thead className="bg-gray-100 dark:bg-gray-900">
                      <tr>
                        {ITEM_COLUMNS.map((col) => (
                          <th
                            key={col.key}
                            className={`border border-gray-300 dark:border-gray-700 py-2 px-3 font-semibold ${
                              col.align === 'right' ? 'text-right' : 'text-left'
                            }`}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {itemEntities.map((item, rowIndex) => (
                        <tr
                          key={rowIndex}
                          className={rowIndex % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'}
                        >
                          {ITEM_COLUMNS.map((col) => (
                            <td
                              key={col.key}
                              className={`border border-gray-300 dark:border-gray-700 py-2 px-3 ${
                                col.align === 'right' ? 'text-right' : 'text-left'
                              }`}
                            >
                              {getPropertyValue(item, col.key)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
