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
                Original 3D room, portfolio concept, engineering and design by
                {' '}<a href="https://henryheffernan.com/">Henry Heffernan</a>,
                2022. The outer room source is reused under its MIT License;
                Henry's copyright notice is preserved in LICENSE.md.
            </p>
            <p>
                Cofounder product adaptation by the Cofounder team, 2026.
            </p>
            <p>
                IE-style OS chrome is adapted from Henry's{' '}
                <a href="https://github.com/henryjeff/portfolio-inner-site">
                    portfolio-inner-site
                </a>{' '}
                at commit 23cf84a. Publication requires written permission
                because that source has no explicit license. Attribution does
                not grant permission.
            </p>
            <p>
                Receipt Printer component and paper textures are adapted from{' '}
                <a href="https://www.dqnamo.com/experiments/receipt-printer">
                    dqnamo's Receipt Printer
                </a>{' '}
                and dqnamo/website commit 55552ac. Its package metadata declares
                ISC, but the source repository has no license file; confirm
                redistribution terms before release.
            </p>
            <p>
                Runtime and UI libraries include React, Three.js, Tween.js,
                Framer Motion, Bezier Easing, QRCode and html-to-image. Each is
                MIT licensed; retained notices are emitted with the production
                JavaScript bundles.
            </p>
            <p>
                The computer, environment and decor models, baked textures,
                local fonts, Windows-style icons, audio and other creative
                assets originate from Henry's two source projects. Their reuse
                remains subject to the permission and asset-rights review above.
            </p>
            <p>
                The OTP email presentation adapts React Email's Protocol demo,
                MIT licensed. Full notices and source links are recorded in
                docs/third-party-notices.md and inner-site/UPSTREAM.md.
            </p>
        </div>
    </Window>
);

export default Credits;
