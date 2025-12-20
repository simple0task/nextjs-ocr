This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

--- スキーマプロンプト
注文書のスキーマを生成してください。

【特別な注意事項】
テーブルの1列目「JANコード/コード」は、1つのセル内に2つの値が縦に並んでいます：
- 1行目：JANコード（13桁、例：4954939021604）→ jan_code として抽出
- 2行目：商品コード（4桁、例：2160）→ product_code として抽出

同様に「品名・規格」列も複数行になっている場合があります：
- 商品名と規格情報を product_name として1つのフィールドにまとめて抽出

【抽出するフィールド】
ヘッダー：発注日、発注書番号、発注元会社、納入先会社、納入依頼先住所、電話番号

明細行（items - ネスト型/繰り返し）：
- jan_code: JANコード（セル内1行目の13桁数字）
- product_code: 商品コード（セル内2行目の4桁数字）
- product_name: 品名・規格
- quantity_per_case: 入数
- box_count: BOX数
- case_count: ケース数
- quantity: 数量
- unit_price: 単価
- amount: 金額
- delivery_date: 納期/備考

1つのセル内に複数行のテキストがある場合は、改行で区切られた各行を個別の値として認識してください。