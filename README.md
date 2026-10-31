# DeepSeek Platform API Key 消费汇总

一个 Tampermonkey / Violentmonkey 用户脚本，用于在 [DeepSeek 开放平台](https://platform.deepseek.com/) 上按 **API Key** 汇总消费金额。

## 功能

- 在平台页面右下角注入一个悬浮面板，无需跳转其它页面
- 可选统计范围：最近 1 / 3 / 6 / 12 个月
- 按 API Key 名称汇总消费金额，并按金额从高到低排序
- 底部显示全部 Key 的合计消费
- 面板支持折叠 / 展开 / 关闭
- 所有请求都直接发往 `platform.deepseek.com`，不会把 token 或数据发送到任何第三方

## 安装

1. 安装浏览器扩展 [Tampermonkey](https://www.tampermonkey.net/)（或 Violentmonkey）
2. 打开脚本文件 [deepseek-api-usage-stats.user.js](./deepseek-api-usage-stats.user.js)，在扩展的安装页面点击「安装」
3. 或直接把该文件拖入浏览器的 Tampermonkey 管理面板

## 使用

1. 登录 <https://platform.deepseek.com/> 并保持登录状态
2. 打开任意平台页面，右下角会出现「消费汇总」面板
3. 选择统计范围（默认最近 12 个月），点击「开始一键统计」
4. 等待分段拉取完成，即可看到各 API Key 的消费金额与总计

## 实现说明

- 从当前页面的 `localStorage.userToken` 读取登录态 token，作为 `Authorization: Bearer` 请求头
- 调用接口：`GET https://platform.deepseek.com/api/v0/usage/by_api_key/cost`，参数 `start` / `end` 按天对齐，`bucket=86400`
- 最多统计 12 个月，按每段 30 天分段请求并累计，避免单次请求跨度过大
- 金额使用 `zh-CN` 本地化格式，保留 2～4 位小数

## 文件结构

```
deepseek-api-usage-stats.user.js   # 用户脚本本体
README.md                          # 说明文档
```

## 注意事项

- 脚本依赖平台页面已登录（`localStorage.userToken` 存在），未登录时会提示「未找到 userToken，请重新登录」
- 平台接口可能随版本调整而变更，脚本中的接口路径与参数以当前实际调用为准
- 消费金额为平台接口返回值的汇总，仅供个人对账参考

## License

MIT
