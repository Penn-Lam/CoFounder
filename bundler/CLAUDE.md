# bundler/

> L2 | 父级: /CLAUDE.md

成员清单
webpack.common.js: 共享 Webpack 配置，构建 3D garage 与 /desktop Diagnostics 双入口；CopyWebpackPlugin 把 25 MiB 内的 static 拷进 public
webpack.prod.js: 唯一构建配置，CleanWebpackPlugin 清理输出目录；开发与生产均由 Wrangler 托管产物

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
