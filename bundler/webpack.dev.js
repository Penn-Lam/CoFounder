/**
 * [INPUT]: 依赖 webpack-merge 合并 common 配置，依赖 portfinder-sync 找空闲端口，依赖 Node os 取本机 IPv4
 * [OUTPUT]: 对外提供 development 模式 webpack 配置，含 webpack-dev-server 5 的 LAN 启动日志
 * [POS]: bundler 的开发入口，与 webpack.prod.js 并列消费 webpack.common.js；不再依赖已披露 SSRF 的 ip 包
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const os = require('os')
const path = require('path')
const { merge } = require('webpack-merge')
const commonConfiguration = require('./webpack.common.js')
const portFinderSync = require('portfinder-sync')

const infoColor = (_message) =>
{
    return `\u001b[1m\u001b[34m${_message}\u001b[39m\u001b[22m`
}

const localIPv4 = () =>
{
    const nets = os.networkInterfaces()
    for (const addrs of Object.values(nets))
    {
        for (const net of addrs || [])
        {
            const familyV4 = net.family === 'IPv4' || net.family === 4
            if (familyV4 && !net.internal)
            {
                return net.address
            }
        }
    }
    return '127.0.0.1'
}

module.exports = merge(
    commonConfiguration,
    {
        stats: 'errors-warnings',
        mode: 'development',
        infrastructureLogging:
        {
            level: 'warn',
        },
        devServer:
        {
            host: 'local-ip',
            port: portFinderSync.getPort(8080),
            open: true,
            allowedHosts: 'all',
            hot: false,
            watchFiles: ['src/**', 'static/**'],
            static:
            {
                watch: true,
                directory: path.join(__dirname, '../static')
            },
            client:
            {
                logging: 'none',
                overlay: true,
                progress: false
            },
            // webpack-dev-server 5 移除了 onAfterSetupMiddleware
            setupMiddlewares: (middlewares, devServer) =>
            {
                const port = devServer.options.port
                const localIp = localIPv4()
                const domain1 = `http://${localIp}:${port}`
                const domain2 = `http://localhost:${port}`

                console.log(`Project running at:\n  - ${infoColor(domain1)}\n  - ${infoColor(domain2)}`)
                return middlewares
            }
        }
    }
)
