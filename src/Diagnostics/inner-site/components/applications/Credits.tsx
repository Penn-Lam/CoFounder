import React from 'react';
import Window from '../os/Window';

export interface CreditsProps extends WindowAppProps {}

const Credits: React.FC<CreditsProps> = (props) => (
    <Window
        top={48}
        left={72}
        width={Math.min(720, window.innerWidth - 96)}
        height={Math.min(520, window.innerHeight - 96)}
        windowTitle="Credits"
        windowBarIcon="windowExplorerIcon"
        closeWindow={props.onClose}
        onInteract={props.onInteract}
        minimizeWindow={props.onMinimize}
        bottomLeftText="Cofounder"
    >
        <div className="credits-content">
            <h2>Credits</h2>
            <p>
                Original portfolio, OS chrome, engineering and design by Henry
                Heffernan, 2022.
            </p>
            <p>
                Cofounder product adaptation by the Cofounder team, 2026.
            </p>
            <p>
                Reused from portfolio-inner-site at commit 23cf84a. Publication
                requires written permission from Henry.
            </p>
        </div>
    </Window>
);

export default Credits;
