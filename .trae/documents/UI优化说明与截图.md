# UI 优化说明与截图

## 1. 图表组件优化（统计页）

### 1.1 支出构成（圆环图）
- 取消“环绕标签”渲染，避免类别多时标签重叠。
- 保留扇区点击筛选逻辑，并新增右侧 Top 分类榜单：百分比 + 金额 + 进度条，更接近参考图 2-3 的信息层次。
- 点击榜单条目与点击扇区一致，均会联动下方趋势图。

### 1.2 总支出趋势（折线图）
- 将密集柱状表现替换为折线图，提升趋势可读性。
- 仍支持点击趋势图选中时间点并联动下方明细。

## 2. 表格与文字显示优化

- 支出明细表格：采用 `table-fixed + nowrap + truncate`，避免窄屏换行导致的行高膨胀。
- 设置-导入记录表格：固定列宽 + 单行省略号显示，保持响应式滚动。
- 预算目标移动端卡片：标题强制单行省略，且对 `"undefined"/"null"` 字符串做兜底显示，避免出现 `备用金 - undefined`。

## 3. 截图产物

运行 `npm run ui:screenshots` 后，会在以下目录生成“优化后”截图（iPhone 12 Pro Max 视口宽高 428×926）：

- `.trae/documents/ui-screenshots/after/statistics.png`
- `.trae/documents/ui-screenshots/after/settings.png`
- `.trae/documents/ui-screenshots/after/budget-config.png`

你提供的图 1-4 可作为“优化前”对比基准。

