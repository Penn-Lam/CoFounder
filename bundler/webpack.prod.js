/**
 * [INPUT]: 依赖 webpack-merge 合并 common，依赖 clean-webpack-plugin 清理 public
 * [OUTPUT]: 对外提供 production 模式 webpack 配置
 * [POS]: bundler 的生产入口，与 webpack.dev.js 并列消费 webpack.common.js
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
