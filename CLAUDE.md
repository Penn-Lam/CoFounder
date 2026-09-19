# CoFounder - 3D 作品集站点（Three.js + Express 联系表单）
React 17 + Three.js 0.137 + Webpack 5 + Express 4 + Nodemailer 10

<directory>
src/ - 前端运行时（Application: Camera/World/UI/Shaders/Utils）
bundler/ - Webpack 开发/生产配置
server/ - 生产静态托管与 /api/send-email
static/ - 模型、贴图、音频、图标等构建期拷贝资源
</directory>
<config>
package.json - 运行时与构建依赖；审计修复走直接升级 + uuid/@types/node overrides，禁止 npm audit fix --force
bundler/webpack.dev.js - 开发服务器；本机 IP 用 os.networkInterfaces，不用 ip 包
server/index.ts - SMTP 联系表单，nodemailer 关闭 file/url 访问
src/tsconfig.json - skipLibCheck；@types/node 钉在 18.x，避免 TS 4.6 解析 Node 26 类型
</config>

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
