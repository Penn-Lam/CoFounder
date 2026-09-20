import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import UIEventBus from '../EventBus';
import { Easing } from '../Animation';
import { getInitialGarageMuted } from '../../Audio/preferences';
// @ts-ignore
import volumeOn from '../../../../static/textures/UI/volume_on.svg';
// @ts-ignore
import volumeOff from '../../../../static/textures/UI/volume_off.svg';

interface MuteToggleProps {}

const MuteToggle: React.FC<MuteToggleProps> = ({}) => {
    const [isHovering, setIsHovering] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [muted, setMuted] = useState(getInitialGarageMuted);

    const toggleMuted = useCallback(
        () => {
            setMuted(!muted);
        },
        [muted]
    );

    const onMouseUpHandler = useCallback(() => {
        setIsActive(false);
    }, []);

    useEffect(() => {
        UIEventBus.dispatch('muteToggle', muted);
    }, [muted]);

    return (
        <button
            type="button"
            aria-label={muted ? '开启车库声音' : '静音车库声音'}
            aria-pressed={muted}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            style={styles.container}
            onMouseDown={() => setIsActive(true)}
            onMouseUp={onMouseUpHandler}
            onClick={toggleMuted}
            className="icon-control-container"
            id="prevent-click"
        >
            <motion.img
                id="prevent-click"
                src={muted ? volumeOff : volumeOn}
                style={{ opacity: isActive ? 0.2 : isHovering ? 0.8 : 1 }}
                width={window.innerWidth < 768 ? 8 : 10}
                animate={
                    isActive ? 'active' : isHovering ? 'hovering' : 'default'
                }
                variants={iconVars}
            />
        </button>
    );
};

const iconVars = {
    hovering: {
        // scale: 1.2,
        opacity: 0.8,
        transition: {
            duration: 0.1,
            ease: 'easeOut',
        },
    },
    active: {
        scale: 0.8,
        opacity: 0.5,
        transition: {
            duration: 0.1,
            ease: Easing.expOut,
        },
    },
    default: {
        scale: 1,
        opacity: 1,
        transition: {
            duration: 0.2,
            ease: 'easeOut',
        },
    },
};

const styles: StyleSheetCSS = {
    container: {
        background: 'black',
        // padding: 4,
        // paddingLeft: 8,
        // paddingRight: 8,
        textAlign: 'center',
        display: 'flex',
        // position: 'absolute',
        boxSizing: 'border-box',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
        border: 0,
        padding: 4,
    },
};

export default MuteToggle;
