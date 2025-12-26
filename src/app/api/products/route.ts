import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // プロジェクトルートのdataディレクトリからproducts.jsonを読み込む
    const filePath = path.join(process.cwd(), 'data', 'products.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContents);

    return NextResponse.json(data);
  } catch (error) {
    console.error('商品マスターデータの読み込みエラー:', error);
    return NextResponse.json(
      { error: '商品マスターデータの読み込みに失敗しました' },
      { status: 500 }
    );
  }
}
