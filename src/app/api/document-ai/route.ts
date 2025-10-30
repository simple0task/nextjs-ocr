import { NextRequest, NextResponse } from 'next/server';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

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

    // プロセッサー名を構築
    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

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
    const text = document.text || '';

    // エンティティを抽出（より詳細な情報を含む）
    const entities = document.entities?.map((entity) => ({
      type: entity.type || '',
      mentionText: entity.mentionText || '',
      confidence: entity.confidence || 0,
      normalizedValue: entity.normalizedValue?.text || '',
      // ページ情報も含める
      pageAnchor: entity.pageAnchor?.pageRefs?.[0]?.page || 0,
    })) || [];

    // フォームフィールド（Form Parserの場合）
    const formFields = document.pages?.[0]?.formFields?.map((field) => ({
      fieldName: field.fieldName?.textAnchor?.content || '',
      fieldValue: field.fieldValue?.textAnchor?.content || '',
      confidence: field.fieldValue?.confidence || 0,
    })) || [];

    // テーブル（表形式データ）
    const tables = document.pages?.[0]?.tables?.map((table) => ({
      headerRows: table.headerRows?.map((row) =>
        row.cells?.map((cell) => cell.layout?.textAnchor?.content?.trim() || '')
      ) || [],
      bodyRows: table.bodyRows?.map((row) =>
        row.cells?.map((cell) => cell.layout?.textAnchor?.content?.trim() || '')
      ) || [],
    })) || [];

    return NextResponse.json({
      text: text.trim(),
      entities,
      formFields,
      tables,
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
