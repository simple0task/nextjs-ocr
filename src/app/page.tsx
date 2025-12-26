'use client';

import { useState, useEffect } from 'react';

// Custom Extractor用の階層構造エンティティ
interface ExtractedEntity {
  type: string;
  value: string;
  confidence: number;
  normalizedValue: string;
  page: number;
  properties: ExtractedEntity[];
}

// 商品マスターデータのインターフェース
interface Product {
  id: number;
  product_code: string;
  product_name: string;
  purchase_price: number;
  sales_price: number;
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

type ProcessorType = 'sannote' | 'yac';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [entities, setEntities] = useState<ExtractedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [processorType, setProcessorType] = useState<ProcessorType>('sannote');
  const [products, setProducts] = useState<Product[]>([]);

  // 商品マスターデータを読み込む
  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(data.products))
      .catch(err => console.error('商品マスターデータの読み込みに失敗しました:', err));
  }, []);

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
      formData.append('processorType', processorType);

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

  // product_codeを4桁に補正し、商品マスターデータと照合する関数
  const normalizeAndValidateProductCode = (item: ExtractedEntity): {
    normalizedCode: string;
    matchedProduct: Product | undefined;
    originalCode: string;
  } => {
    const originalCode = getPropertyValue(item, 'product_code');
    // 4桁以上の場合は最初の4桁に変換
    const normalizedCode = originalCode.length >= 4 ? originalCode.substring(0, 4) : originalCode;
    // 商品マスターデータから該当するデータを検索
    const matchedProduct = products.find(p => p.product_code === normalizedCode);

    return {
      normalizedCode,
      matchedProduct,
      originalCode
    };
  };

  // 補正されたproduct_codeまたはproduct_nameを取得する関数
  const getCorrectedValue = (item: ExtractedEntity, key: string): string => {
    if (key === 'product_code' || key === 'product_name') {
      const { normalizedCode, matchedProduct, originalCode } = normalizeAndValidateProductCode(item);

      if (key === 'product_code') {
        // 4桁以上で該当データがある場合は4桁に補正
        if (originalCode.length >= 4 && matchedProduct) {
          return normalizedCode;
        }
        return originalCode;
      } else if (key === 'product_name') {
        // 4桁以上で該当データがある場合はマスターデータの商品名を使用
        if (originalCode.length >= 4 && matchedProduct) {
          return matchedProduct.product_name;
        }
        return getPropertyValue(item, key);
      }
    }
    return getPropertyValue(item, key);
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
        const value = getCorrectedValue(item, col.key);
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
    <div className="min-h-screen p-2 sm:p-2" style={{ backgroundColor: '#F5F2F2' }}>
      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(245, 242, 242, 0.95)' }}>
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4" style={{ borderColor: '#5A7ACD', borderWidth: '1px' }}>
            <div className="flex flex-col items-center gap-6">
              {/* Loading text */}
              <div className="text-center space-y-2">
                <p className="text-sm" style={{ color: '#2B2A2A', opacity: 0.9 }}>
                  注文書を読み取っています...
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full rounded-full h-3 overflow-hidden" style={{ backgroundColor: '#F5F2F2' }}>
                <div className="h-full rounded-full animate-progress" style={{ backgroundColor: '#5A7ACD' }} />
              </div>

            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto relative">
        {/* Header */}
        <div className="mb-8 pt-4">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-2 h-16 rounded-full" style={{ backgroundColor: '#5A7ACD' }} />
            <div>
              <h1 className="text-4xl font-bold" style={{ color: '#2B2A2A' }}>
                注文書読み取りデモ
              </h1>
              <p className="mt-1" style={{ color: '#2B2A2A', opacity: 0.6 }}>Fuji Grace - Document AI</p>
            </div>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-3xl shadow-lg p-8 mb-6" style={{ border: '1px solid #F5F2F2' }}>
          <div className="mb-6">
            <label
              htmlFor="file-upload"
              className="block text-sm font-semibold mb-3"
              style={{ color: '#2B2A2A' }}
            >
              📄 注文書を選択してください
            </label>
            <input
              id="file-upload"
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              className="block w-full text-sm
                        file:mr-4 file:py-3 file:px-6
                        file:rounded-xl file:border-0
                        file:text-sm file:font-semibold
                        file:text-white
                        file:transition-all file:duration-200
                        file:cursor-pointer file:shadow-md
                        cursor-pointer"
              style={{
                color: '#2B2A2A'
              }}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-3" style={{ color: '#2B2A2A' }}>
              🏢 注文書タイプを選択してください
            </label>
            <div className="flex gap-3">
              <label className="flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="processorType"
                  value="sannote"
                  checked={processorType === 'sannote'}
                  onChange={(e) => setProcessorType(e.target.value as ProcessorType)}
                  className="sr-only"
                />
                <div
                  className="p-4 rounded-2xl border-2 transition-all duration-200 text-sm font-medium"
                  style={processorType === 'sannote'
                    ? { borderColor: '#5A7ACD', backgroundColor: '#5A7ACD', color: 'white', boxShadow: '0 4px 6px rgba(90, 122, 205, 0.2)' }
                    : { borderColor: '#F5F2F2', backgroundColor: '#F5F2F2', color: '#2B2A2A' }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                      style={processorType === 'sannote'
                        ? { borderColor: 'white', backgroundColor: 'white' }
                        : { borderColor: '#2B2A2A', opacity: 0.3 }}>
                      {processorType === 'sannote' && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" style={{ color: '#5A7ACD' }}>
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    サンノート株式会社
                  </div>
                </div>
              </label>
              <label className="flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="processorType"
                  value="yac"
                  checked={processorType === 'yac'}
                  onChange={(e) => setProcessorType(e.target.value as ProcessorType)}
                  className="sr-only"
                />
                <div
                  className="p-4 rounded-2xl border-2 transition-all duration-200 text-sm font-medium"
                  style={processorType === 'yac'
                    ? { borderColor: '#5A7ACD', backgroundColor: '#5A7ACD', color: 'white', boxShadow: '0 4px 6px rgba(254, 176, 93, 0.2)' }
                    : { borderColor: '#F5F2F2', backgroundColor: '#F5F2F2', color: '#2B2A2A' }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                      style={processorType === 'yac'
                        ? { borderColor: 'white', backgroundColor: 'white' }
                        : { borderColor: '#2B2A2A', opacity: 0.3 }}>
                      {processorType === 'yac' && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" style={{ color: '#5A7ACD' }}>
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    槌屋YAC株式会社
                  </div>
                </div>
              </label>
            </div>
          </div>

          {selectedFile && (
            <div className="mb-6 p-5 border-2 rounded-2xl animate-slideIn" style={{ backgroundColor: '#F5F2F2', borderColor: '#5A7ACD' }}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md" style={{ backgroundColor: '#5A7ACD' }}>
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold mb-1" style={{ color: '#5A7ACD' }}>ファイル選択完了</p>
                  <p className="text-sm font-medium truncate" style={{ color: '#2B2A2A' }}>{selectedFile.name}</p>
                  <p className="text-xs mt-1" style={{ color: '#2B2A2A', opacity: 0.6 }}>{(selectedFile.size / 1024).toFixed(2)} KB</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleProcessDocument}
            disabled={!selectedFile || isLoading}
            className="w-full text-white font-bold py-4 px-8 rounded-2xl transition-all duration-200 shadow-lg transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: !selectedFile || isLoading ? '#2B2A2A' : '#5A7ACD'
            }}
          >
            <div className="flex items-center justify-center gap-3">
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>解析中...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>AI解析を開始</span>
                </>
              )}
            </div>
          </button>
        </div>

        {error && (
          <div className="border-2 rounded-2xl px-6 py-4 mb-6 animate-slideIn" style={{ backgroundColor: '#5A7ACD', borderColor: '#5A7ACD', opacity: 0.9 }}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#2B2A2A' }}>
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-bold mb-1" style={{ color: '#2B2A2A' }}>エラーが発生しました</p>
                <p className="text-sm" style={{ color: '#2B2A2A', opacity: 0.9 }}>{error}</p>
              </div>
            </div>
          </div>
        )}

        {entities.length > 0 && (
          <div className="animate-slideIn space-y-6">
            {/* ヘッダー情報（JSONから動的生成） */}
            {allHeaderEntities.length > 0 && (
              <div className="bg-white rounded-3xl shadow-lg p-8" style={{ border: '1px solid #F5F2F2' }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-2 h-10 rounded-full" style={{ backgroundColor: '#5A7ACD' }} />
                  <h2 className="text-2xl font-bold" style={{ color: '#2B2A2A' }}>📋 注文書情報</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allHeaderEntities.map((entity, index) => (
                    <div
                      key={index}
                      className="border p-4 rounded-2xl hover:shadow-md transition-all duration-200"
                      style={{ backgroundColor: '#F5F2F2', borderColor: '#F5F2F2' }}
                    >
                      <div className="text-xs font-semibold mb-2 uppercase" style={{ color: '#5A7ACD' }}>
                        {entity.type.replace(/_/g, ' ')}
                      </div>
                      <div className="whitespace-pre-line font-medium" style={{ color: '#2B2A2A' }}>
                        {entity.value || entity.normalizedValue || '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 明細テーブル（JSONから動的生成） */}
            {itemEntities.length > 0 && (
              <div className="bg-white rounded-3xl shadow-lg p-8" style={{ border: '1px solid #F5F2F2' }}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-10 rounded-full" style={{ backgroundColor: '#5A7ACD' }} />
                    <div>
                      <h2 className="text-2xl font-bold" style={{ color: '#2B2A2A' }}>📊 明細一覧</h2>
                      <p className="text-sm mt-1" style={{ color: '#2B2A2A', opacity: 0.6 }}>{itemEntities.length}件のアイテム</p>
                    </div>
                  </div>
                  <button
                    onClick={handleDownloadCsv}
                    className="text-white font-bold py-3 px-6 rounded-2xl transition-all duration-200 shadow-lg cursor-pointer text-sm transform hover:scale-105 active:scale-95"
                    style={{ backgroundColor: '#5A7ACD' }}
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      CSVダウンロード
                    </div>
                  </button>
                </div>

                {/* データ不一致の説明 */}
                <div className="mb-6 p-2 border-2 rounded-2xl" style={{ backgroundColor: '#5A7ACD', borderColor: '#5A7ACD' }}>
                  <div className="flex items-center gap-3" style={{ opacity: 1 }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#5A7ACD' }}>
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <p className="text-sm" style={{ color: '#FFFFFF' }}>
                      <span>ご注意：</span>薄くなっている行は、商品コードが4桁以上ですが商品マスターデータに該当する商品が見つかりませんでした。
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border-2" style={{ borderColor: '#F5F2F2' }}>
                  <table className="w-full text-sm border-collapse">
                    <thead style={{ backgroundColor: '#5A7ACD' }}>
                      <tr>
                        {ITEM_COLUMNS.map((col, idx) => (
                          <th
                            key={col.key}
                            className={`py-3 px-4 font-bold text-white text-xs ${
                              col.align === 'right' ? 'text-right' : 'text-left'
                            }`}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {itemEntities.map((item, rowIndex) => {
                        const { normalizedCode, matchedProduct, originalCode } = normalizeAndValidateProductCode(item);
                        const hasNoMatch = originalCode.length >= 4 && !matchedProduct;

                        return (
                          <tr
                            key={rowIndex}
                            className="transition-all duration-150"
                            style={{
                              borderBottom: '1px solid #F5F2F2',
                              backgroundColor: hasNoMatch ? '#5A7ACD' : (rowIndex % 2 === 0 ? 'white' : '#F5F2F2'),
                              opacity: hasNoMatch ? 0.5 : 1
                            }}
                          >
                            {ITEM_COLUMNS.map((col) => (
                              <td
                                key={col.key}
                                className={`py-3 px-4 ${
                                  col.align === 'right' ? 'text-right tabular-nums' : 'text-left'
                                } ${hasNoMatch ? 'font-medium' : ''}`}
                                style={{ color: '#2B2A2A' }}
                              >
                                {getCorrectedValue(item, col.key)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
