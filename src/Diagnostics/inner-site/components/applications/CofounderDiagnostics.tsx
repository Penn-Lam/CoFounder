import React, { useEffect, useState } from 'react';
import Window from '../os/Window';

export interface CofounderDiagnosticsProps extends WindowAppProps {}

const getRouteLabel = (path: string) => {
    if (path.startsWith('/invite/')) return 'PAIR INVITATION';
    if (path.startsWith('/auth/')) return 'ACCOUNT RETURN';
    if (path.startsWith('/r/')) return 'PUBLIC RESULT';
    return 'SYSTEM READY';
};

const CofounderDiagnostics: React.FC<CofounderDiagnosticsProps> = (props) => {
    const [path, setPath] = useState(window.location.pathname);
    const compact = window.innerWidth < 640;

    useEffect(() => {
        const updatePath = () => setPath(window.location.pathname);
        window.addEventListener('popstate', updatePath);
        return () => window.removeEventListener('popstate', updatePath);
    }, []);

    return (
        <Window
            top={compact ? 8 : 24}
            left={compact ? 8 : 104}
            width={Math.max(320, window.innerWidth - (compact ? 16 : 160))}
            height={Math.max(420, window.innerHeight - (compact ? 48 : 100))}
            windowTitle="Cofounder Diagnostics - Showcase 2026"
            windowBarIcon="windowExplorerIcon"
            closeWindow={props.onClose}
            onInteract={props.onInteract}
            minimizeWindow={props.onMinimize}
            bottomLeftText="OS chrome © 2022 Henry Heffernan"
        >
            <div className="diagnostics-browser">
                <div className="browser-menu" aria-label="Browser menu">
                    <span><u>F</u>ile</span>
                    <span><u>E</u>dit</span>
                    <span><u>V</u>iew</span>
                    <span>F<u>a</u>vorites</span>
                    <span><u>H</u>elp</span>
                </div>
                <div className="address-bar">
                    <span>Address</span>
                    <div>cofounder.local{path}</div>
                    <strong>Go</strong>
                </div>
                <main className="diagnostics-content">
                    <p className="diagnostics-kicker">
                        AI COFOUNDER DIAGNOSTICS / {getRouteLabel(path)}
                    </p>
                    <h1>你们放在一起，会形成一家什么样的公司？</h1>
                    <p className="diagnostics-description">
                        双人合伙关系压力测试。这里将承载邀请、答题与报告流程。
                        当前应用已经与 3D Garage 同源连接。
                    </p>
                    <div className="diagnostics-status">
                        <div><b>MODE</b><span>2 PARTICIPANTS</span></div>
                        <div><b>DURATION</b><span>ABOUT 10 MIN</span></div>
                        <div><b>ROUTE</b><span>{path}</span></div>
                    </div>
                    <div className="diagnostics-actions">
                        <button type="button" disabled>
                            START TEST — COMING NEXT
                        </button>
                        <a href="/?experience=3d">OPEN FULL 3D EXPERIENCE</a>
                    </div>
                    <p className="diagnostics-disclaimer">
                        娱乐测试，不构成心理、投资或专业建议。
                    </p>
                </main>
            </div>
        </Window>
    );
};

export default CofounderDiagnostics;
