# 内容编辑说明

项目首页旧照片数据集中在：

`public/data/memories.json`

可直接修改以下字段，不需要改代码：

- `title`：照片标题或记忆标题
- `tags`：关键词数组，用于匹配用户输入
- `mood`：情绪标签，用于无匹配结果时兜底
- `era`：时代标签
- `src`：照片路径，必须指向 `public/assets` 下的图片

修改后刷新页面即可生效。  
如果新增“可被关键词匹配到的回忆图片”，建议先放到 `public/assets/aigen-old`，再在 `memories.json` 中增加一条对应记录。

素材目录说明：

- `public/assets/aigen-old`：主回忆图片池，来自旧项目的 `memories.json`，用于主页初始回忆、关键词匹配、加载结果、编辑保存。
- `public/assets/old-city`：旧城实拍/旧城照片素材，用作旧城视觉素材池，不是关键词数据的主来源。
- `public/assets/new-city`：现代城市图片，用于围挡拆除后的新城图层。
- `public/assets/barrier`：围挡图层，用于“旧照褪去 → 围挡遮挡 → 新城出现”的城市更新时间线。
- `public/assets/backgrounds`：地图、logo、纸张和硫酸纸纹理。
- `public/assets/buttons`：唤醒回忆按钮 normal/hover 两态。
