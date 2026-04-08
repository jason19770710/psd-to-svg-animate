

## 修正：保留背景圖層

### 問題
`src/lib/psd-parser.ts` 第 73 行有一個硬編碼的過濾條件，會跳過名稱為 `"Background"` 或 `"背景"` 的圖層，導致背景圖層完全消失。

### 修改內容

**檔案：`src/lib/psd-parser.ts`**
- 移除第 73 行的 `if (node.name === "Background" || node.name === "背景") continue;`
- 背景圖層將與其他圖層一樣被正常提取、顯示、可設定動畫

只需修改這一行，預覽與匯出邏輯已支援所有圖層的顯示與堆疊。

