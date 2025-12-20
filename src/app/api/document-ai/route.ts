import { NextRequest, NextResponse } from 'next/server';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { google } from '@google-cloud/documentai/build/protos/protos';

type ITextAnchor = google.cloud.documentai.v1.Document.ITextAnchor;
type IEntity = google.cloud.documentai.v1.Document.IEntity;

// textAnchorからテキストを抽出するヘルパー関数
function extractTextFromAnchor(textAnchor: ITextAnchor | null | undefined, fullText: string): string {
  if (!textAnchor?.textSegments || textAnchor.textSegments.length === 0) {
    return '';
  }

  return textAnchor.textSegments
    .map((segment) => {
      const startIndex = Number(segment.startIndex || 0);
      const endIndex = Number(segment.endIndex || 0);
      return fullText.substring(startIndex, endIndex);
    })
    .join('')
    .trim();
}

// Custom Extractor用: エンティティを再帰的に処理してフラットな構造に変換
interface ExtractedEntity {
  type: string;
  value: string;
  confidence: number;
  normalizedValue: string;
  page: number;
  properties: ExtractedEntity[];
}

function processEntity(entity: IEntity, fullText: string): ExtractedEntity {
  // mentionTextがあればそれを使用、なければtextAnchorから抽出
  const value = entity.mentionText || extractTextFromAnchor(entity.textAnchor, fullText);

  return {
    type: entity.type || '',
    value,
    confidence: entity.confidence || 0,
    normalizedValue: entity.normalizedValue?.text || '',
    page: Number(entity.pageAnchor?.pageRefs?.[0]?.page || 0) + 1,
    properties: entity.properties?.map(prop => processEntity(prop, fullText)) || [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'ファイルが見つかりません' },
        { status: 400 }
      );
    }

    // 環境変数の確認
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION;
    const processorId = process.env.GOOGLE_CLOUD_PROCESSOR_ID;
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const versionId = process.env.GOOGLE_CLOUD_VERSION_ID;

    if (!projectId || !location || !processorId) {
      return NextResponse.json(
        { error: '環境変数が設定されていません。.env.localを確認してください。' },
        { status: 500 }
      );
    }

    // ファイルをバッファに変換
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Document AI クライアントの初期化
    // Vercel環境ではJSONを直接パース、ローカル環境ではファイルパスを使用
    let client: DocumentProcessorServiceClient;

    if (credentials) {
      try {
        // JSONとしてパースを試みる（Vercel用）
        const credentialsJson = JSON.parse(credentials);
        client = new DocumentProcessorServiceClient({
          credentials: credentialsJson,
        });
      } catch {
        // パースに失敗したらファイルパスとして扱う（ローカル用）
        client = new DocumentProcessorServiceClient({
          keyFilename: credentials,
        });
      }
    } else {
      // 環境変数が未設定の場合はデフォルト認証を使用
      client = new DocumentProcessorServiceClient();
    }

    // プロセッサー名を構築（バージョン指定あり）
    const name = `projects/${projectId}/locations/${location}/processors/${processorId}/processorVersions/${versionId}`;

    // ドキュメント処理リクエスト
    const [result] = await client.processDocument({
      name,
      rawDocument: {
        content: buffer,
        mimeType: file.type,
      },
    });

    const { document } = result;

    if (!document) {
      return NextResponse.json(
        { error: 'ドキュメントの解析に失敗しました' },
        { status: 500 }
      );
    }

    // テキストとエンティティを抽出
    const fullText = document.text || '';

    // Custom Extractor用: エンティティを階層構造で抽出
    // items（明細行）の中にjan_code, product_codeなどがネストされる
    const entities = document.entities?.map((entity) => processEntity(entity, fullText)) || [];

    return NextResponse.json({
      text: fullText.trim(),
      entities,
      pageCount: document.pages?.length || 0,
      success: true,
    });
  } catch (error) {
    console.error('Document AI処理エラー:', error);
    return NextResponse.json(
      {
        error: 'Document AI処理中にエラーが発生しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
