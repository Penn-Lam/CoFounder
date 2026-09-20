/**
 * [INPUT]: 依赖 copy-webpack-plugin / html-webpack-plugin / mini-css-extract-plugin 与 ts-loader/babel-loader
 * [OUTPUT]: 对外提供共享 Webpack 配置：构建 3D garage 与 /desktop Diagnostics，输出 public，拷贝静态资源
 * [POS]: bundler 的公共底盘，由 webpack.prod.js 合并后供 Worker 开发与生产环境使用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCSSExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');

module.exports = {
    entry: {
        garage: path.resolve(__dirname, '../src/script.ts'),
        desktop: path.resolve(__dirname, '../src/Diagnostics/index.tsx'),
    },
    output: {
        hashFunction: 'xxhash64',
        filename: '[name]/bundle.[contenthash].js',
        path: path.resolve(__dirname, '../public'),
    },
    devtool: 'source-map',
    plugins: [
        new CopyWebpackPlugin({
            patterns: [{ from: path.resolve(__dirname, '../static') }],
        }),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, '../src/index.html'),
            filename: 'index.html',
            chunks: ['garage'],
            minify: true,
        }),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, '../src/Diagnostics/index.html'),
            filename: 'desktop/index.html',
            chunks: ['desktop'],
            minify: true,
        }),
        new MiniCSSExtractPlugin({
            filename: '[name]/style.[contenthash].css',
        }),
    ],
    resolve: {
        alias: {
            three: path.resolve('./node_modules/three'),
        },
        extensions: ['.tsx', '.ts', '.js'],
    },
    module: {
        rules: [
            // HTML
            {
                test: /\.(html)$/,
                use: ['html-loader'],
            },
            {
                test: /\.ts?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            // JS
            {
                test: /\.tsx$/,
                exclude: /node_modules/,
                use: ['babel-loader'],
            },

            // CSS
            {
                test: /\.css$/,
                use: [MiniCSSExtractPlugin.loader, 'css-loader'],
            },

            // Images
            {
                test: /\.(jpg|png|gif|svg)$/,
                type: 'asset/resource',
                generator: {
                    filename: 'assets/images/[hash][ext]',
                },
            },
            // Audio
            {
                test: /\.(mp3|wav)$/,
                loader: 'file-loader',
                options: {
                    name: '[path][name].[ext]',
                },
            },
            // Fonts
            {
                test: /\.(ttf|eot|woff|woff2)$/,
                type: 'asset/resource',
                generator: {
                    filename: 'assets/fonts/[hash][ext]',
                },
            },
            // Shaders
            {
                test: /\.(glsl|vs|fs|vert|frag)$/,
                exclude: /node_modules/,
                use: ['glslify-import-loader', 'raw-loader', 'glslify-loader'],
            },
        ],
    },
};
