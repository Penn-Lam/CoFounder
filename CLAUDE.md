# CoFounder - 3D Garage + 合伙人压力测试

React 17 + Three.js 0.137 + Webpack 5 + Cloudflare Workers + Hono

<directory>
src/ - 前端运行时（3D Garage Application + /desktop Diagnostics）
bundler/ - Webpack 开发/生产配置
worker/ - Cloudflare Worker/Hono 同源路由、Better Auth Account 边界与 R2 媒体读取
migrations/ - D1 的 Better Auth、版本化 consent、OTP 限流与隐私数据生命周期迁移
static/ - 25 MiB 内的模型、贴图、音频、图标等构建期拷贝资源
r2-assets/ - 超过 Workers Static Assets 限制、需上传 R2 的媒体源文件
.agents/ - Amp Orb 初始化与唤醒生命周期脚本
docs/ - 产品决策与后续架构决策记录
</directory>
<config>
CONTEXT.md - 合伙人压力测试领域术语表
package.json / bun.lock - Bun 版本与运行时/构建依赖；审计修复走直接升级 + uuid/@types/node/@types/minimatch overrides，禁止 npm audit fix --force
.agents/setup - 为新 Orb 安装固定版本 Bun、Mintlify CLI 与冻结依赖
.agents/resume - Orb 唤醒时的快速恢复检查（当前无持久服务）
package.json dev/start - 先构建、迁移本地 D1 并填充本地 R2，再由 Wrangler 提供与生产一致的 Worker 路由
wrangler.jsonc - Worker Static Assets、DB D1 与 MEDIA R2 绑定；开发、生产共用路由模型
.dev.vars.example - Better Auth 与 Resend 所需变量模板；真实值只放未跟踪的 `.dev.vars` 或 Worker secrets
src/tsconfig.json / worker/tsconfig.json - 前端与 Worker 分开做严格类型检查；@types/node 钉在 18.x
src/Diagnostics/inner-site/UPSTREAM.md - Henry `portfolio-inner-site` 的复用来源与未获许可前禁止发布的约束
</config>

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues for `Penn-Lam/CoFounder`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Use the single-context layout: root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
