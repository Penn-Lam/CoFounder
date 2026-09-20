import React from 'react';
import ReactDOM from 'react-dom';
import Desktop from './inner-site/components/os/Desktop';
import './inner-site/index.css';
import './inner-site/App.css';
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

ReactDOM.render(
    <div className="App">
        <Desktop />
    </div>,
    document.getElementById('diagnostics')
);
