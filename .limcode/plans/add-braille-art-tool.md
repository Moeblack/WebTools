# 增加点阵画 (Braille Art) 工具计划

该功能将允许用户上传图片并将其转换为由盲文 Unicode 字符（U+2800 - U+28FF）组成的 ASCII 艺术画。

## 1. 核心逻辑实现 (`src/tools/braille.js`)

实现转换核心函数 `imageToBraille(imageData, width, height, options)`:
- **缩放处理**：Braille 字符通常对应 2x4 的像素区域。为了保证输出内容不至于过大，需要先将原图缩放到合适的大小。
- **灰度化与二值化**：将每个像素转换为亮度值，并根据设定的 `threshold` 判断该点是否为“点”。
- **位运算映射**：
  盲文 Unicode 偏移计算方法：
  ```
  1 4
  2 5
  3 6
  7 8
  ```
  对应位权：
  - (x, y) = (0, 0) -> 1
  - (0, 1) -> 2
  - (0, 2) -> 4
  - (1, 0) -> 8
  - (1, 1) -> 16
  - (1, 2) -> 32
  - (0, 3) -> 64
  - (1, 3) -> 128
- **选项支持**：
  - `invert`: 反转黑白。
  - `threshold`: 调整二值化阈值。

## 2. UI 组件开发 (`src/components/tools/BrailleTool.vue`)

- **布局设计**：参考 `PaletteTool.vue` 的双栏布局。
- **功能点**：
  - 图片上传（支持拖拽）。
  - 参数调节：
    - 输出宽度（字符数）。
    - 阈值调节（滑块）。
    - 反色切换。
  - 实时预览：使用 `<pre>` 标签展示结果，支持缩放查看。
  - 复制功能：一键复制生成的文本。

## 3. 全局集成 (`src/App.vue`)

- 在 `tabs` 列表中加入“点阵画”选项。
- 引入并注册 `BrailleTool.vue` 组件。

## 4. 样式调整

- 确保预览区域的字体使用等宽字体（如 `Courier New`, `monospace`）。
- 盲文点阵在不同字体下宽度可能不一致，需要测试常用字体的兼容性。

## TODO LIST

<!-- LIMCODE_TODO_LIST_START -->
- [ ] 在 src/App.vue 中注册新工具  `#integration`
- [ ] 创建 src/tools/braille.js 转换逻辑  `#logic`
- [ ] 进行样式优化与测试  `#style_test`
- [ ] 创建 src/components/tools/BrailleTool.vue UI 组件  `#ui`
<!-- LIMCODE_TODO_LIST_END -->
