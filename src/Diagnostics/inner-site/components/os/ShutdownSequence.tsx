import React from 'react';

export interface ShutdownSequenceProps {
    setShutdown: React.Dispatch<React.SetStateAction<boolean>>;
    numShutdowns: number;
}

const ShutdownSequence: React.FC<ShutdownSequenceProps> = ({ setShutdown }) => (
    <div className="shutdown-sequence">
        <p>COFOUNDER DIAGNOSTICS SHUTDOWN COMPLETE.</p>
        <button type="button" onClick={() => setShutdown(false)}>
            RESTART
        </button>
    </div>
);

export default ShutdownSequence;
