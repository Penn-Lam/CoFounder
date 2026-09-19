# bundler/
> L2 | 父级: /CLAUDE.md

成员清单
webpack.common.js: 共享 Webpack 配置，CopyWebpackPlugin 把 static 拷进 public，HtmlWebpackPlugin + MiniCSSExtractPlugin 出入口资源
webpack.dev.js: development 配置，webpack-dev-server 5 的 setupMiddlewares 打印 LAN/localhost，本机 IPv4 由 Node os 解析
webpack.prod.js: production 配置，CleanWebpackPlugin 清理输出目录

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
