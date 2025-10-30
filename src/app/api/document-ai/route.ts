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
    const client = new DocumentProcessorServiceClient();

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
    const entities = document.entities?.map((entity) => ({
      type: entity.type || '',
      mentionText: entity.mentionText || '',
      confidence: entity.confidence || 0,
      normalizedValue: entity.normalizedValue?.text || '',
    })) || [];

    return NextResponse.json({
      text: text.trim(),
      entities,
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
