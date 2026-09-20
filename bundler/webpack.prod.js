/**
 * [INPUT]: 依赖 webpack-merge 合并 common，依赖 clean-webpack-plugin 清理 public
 * [OUTPUT]: 对外提供 development 与 production 共用的 production-mode Webpack 构建配置
 * [POS]: bundler 的唯一构建入口，消费 webpack.common.js 后产出由 Wrangler 托管的 public
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const { merge } = require('webpack-merge')
const commonConfiguration = require('./webpack.common.js')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

module.exports = merge(
    commonConfiguration,
    {
        mode: 'production',
        plugins:
        [
            new CleanWebpackPlugin()
        ]
    }
)
