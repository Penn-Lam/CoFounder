import React from 'react';
import ReactDOM from 'react-dom';
import './style.css';

const bridgeEvents = [
    'mousemove',
    'mousedown',
    'mouseup',
    'keydown',
    'keyup',
] as const;

const forwardEventToGarage = (event: MouseEvent | KeyboardEvent) => {
    if (window.parent === window) return;

    const payload =
        event instanceof MouseEvent
            ? {
                  type: event.type,
                  clientX: event.clientX,
                  clientY: event.clientY,
              }
            : { type: event.type, key: event.key };

    window.parent.postMessage(payload, window.location.origin);
};

for (const eventName of bridgeEvents) {
    window.addEventListener(eventName, forwardEventToGarage);
}

const getEntryLabel = () => {
    const path = window.location.pathname;

    if (path.startsWith('/invite/')) return 'PAIR INVITATION';
    if (path.startsWith('/auth/')) return 'ACCOUNT RETURN';
    if (path.startsWith('/r/')) return 'PUBLIC RESULT';
    return 'SYSTEM READY';
};

const Diagnostics = () => (
    <main className="desktop-shell">
        <header className="system-bar">
            <span>AI COFOUNDER DIAGNOSTICS</span>
            <span>{getEntryLabel()}</span>
        </header>

        <section className="window" aria-labelledby="diagnostics-title">
            <div className="window-title">
                <span id="diagnostics-title">Cofounder Diagnostics</span>
                <span aria-hidden="true">_ □ ×</span>
            </div>
            <div className="window-body">
                <p className="eyebrow">
                    STARTUP RELATIONSHIP SYSTEM / MVP SHELL
                </p>
                <h1>
                    你们放在一起，
                    <br />
                    会形成一家什么样的公司？
                </h1>
                <p className="description">
                    双人合伙关系压力测试。这里将承载邀请、答题与报告流程。
                    当前应用壳已经与 3D Garage 同源连接。
                </p>
                <dl className="status-grid">
                    <div>
                        <dt>MODE</dt>
                        <dd>2 PARTICIPANTS</dd>
                    </div>
                    <div>
                        <dt>DURATION</dt>
                        <dd>ABOUT 10 MIN</dd>
                    </div>
                    <div>
                        <dt>ROUTE</dt>
                        <dd>{window.location.pathname}</dd>
                    </div>
                </dl>
                <div className="actions">
                    <button type="button" disabled>
                        START TEST — COMING NEXT
                    </button>
                    <a href="/?experience=3d">OPEN FULL 3D EXPERIENCE</a>
                </div>
            </div>
        </section>

        <footer>娱乐测试，不构成心理、投资或专业建议。</footer>
    </main>
);

ReactDOM.render(<Diagnostics />, document.getElementById('diagnostics'));
