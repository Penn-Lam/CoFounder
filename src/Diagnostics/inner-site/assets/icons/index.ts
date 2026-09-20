import React from 'react';

import windowResize from './windowResize.png';
import maximize from './maximize.png';
import minimize from './minimize.png';
import computerBig from './computerBig.png';
import showcaseIcon from './showcaseIcon.png';
import credits from './credits.png';
import volumeOn from './volumeOn.png';
import windowExplorerIcon from './windowExplorerIcon.png';
import windowsStartIcon from './windowsStartIcon.png';
import close from './close.png';

const icons = {
    windowResize: windowResize,
    maximize: maximize,
    minimize: minimize,
    computerBig: computerBig,
    showcaseIcon: showcaseIcon,
    volumeOn: volumeOn,
    credits: credits,
    close: close,
    windowExplorerIcon: windowExplorerIcon,
    windowsStartIcon: windowsStartIcon,
};

export type IconName = keyof typeof icons;

const getIconByName = (
    iconName: IconName
    // @ts-ignore
): React.FC<React.SVGAttributes<SVGElement>> => icons[iconName];

export default getIconByName;
