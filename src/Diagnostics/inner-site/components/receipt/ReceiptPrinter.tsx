// Adapted from dqnamo/website ReceiptPrinter.tsx at commit 55552ace.
// Tailwind classes were replaced with local CSS for this React 17 application.
import { CheckCircle, CircleNotch } from '@phosphor-icons/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import React, {
    ComponentPropsWithoutRef,
    createContext,
    ReactNode,
    useContext,
} from 'react';

export type ReceiptPrinterStage = 'processing' | 'printing' | 'complete';
export type ReceiptFeedMotion = 'smooth' | 'stepped';

type RootProps = Omit<ComponentPropsWithoutRef<'section'>, 'children'> & {
    animate?: boolean;
    children: ReactNode;
    feedMotion?: ReceiptFeedMotion;
    stage: ReceiptPrinterStage;
};

type ContextValue = {
    animate: boolean;
    feedMotion: ReceiptFeedMotion;
    shouldMove: boolean;
    stage: ReceiptPrinterStage;
};

const ReceiptPrinterContext = createContext<ContextValue | null>(null);
const easeOut = [0.23, 1, 0.32, 1] as const;
const easeInOut = [0.77, 0, 0.175, 1] as const;

const receiptToothCount = 40;
const receiptToothDepth = 4;
const receiptToothPoints = Array.from(
    { length: receiptToothCount * 2 },
    (_, index) => {
        const x =
            100 - ((index + 1) * 100) / (receiptToothCount * 2);
        const y =
            index % 2 === 0
                ? '100%'
                : `calc(100% - ${receiptToothDepth}px)`;
        return `${x}% ${y}`;
    },
).join(', ');
const receiptClipPath = `polygon(0 0, 100% 0, 100% calc(100% - ${receiptToothDepth}px), ${receiptToothPoints})`;

const printingTransformKeyframes = [
    'translateY(calc(-100% + 2px))',
    'translateY(-91%)',
    'translateY(-91%)',
    'translateY(-81%)',
    'translateY(-81%)',
    'translateY(-70%)',
    'translateY(-70%)',
    'translateY(-58%)',
    'translateY(-58%)',
    'translateY(-45%)',
    'translateY(-45%)',
    'translateY(-32%)',
    'translateY(-32%)',
    'translateY(-20%)',
    'translateY(-20%)',
    'translateY(-10%)',
    'translateY(-10%)',
    'translateY(-3%)',
    'translateY(-3%)',
    'translateY(0%)',
];

const printingKeyframeTimes = [
    0, 0.075, 0.105, 0.18, 0.21, 0.285, 0.315, 0.39, 0.42, 0.495,
    0.525, 0.6, 0.63, 0.705, 0.735, 0.81, 0.84, 0.915, 0.945, 1,
];

const classNames = (...values: Array<string | undefined>) =>
    values.filter(Boolean).join(' ');

const useReceiptPrinter = (component: string) => {
    const context = useContext(ReceiptPrinterContext);
    if (!context) {
        throw new Error(`${component} must be used inside ReceiptPrinter.Root.`);
    }
    return context;
};

const Root = ({
    'aria-label': ariaLabel = 'Receipt printer',
    animate = true,
    children,
    className,
    feedMotion = 'stepped',
    stage,
    ...props
}: RootProps) => {
    const shouldReduceMotion = useReducedMotion();
    return (
        <ReceiptPrinterContext.Provider
            value={{
                animate,
                feedMotion,
                shouldMove: animate && !shouldReduceMotion,
                stage,
            }}
        >
            <section
                aria-label={ariaLabel}
                className={classNames('receipt-printer', className)}
                data-stage={stage}
                {...props}
            >
                {children}
            </section>
        </ReceiptPrinterContext.Provider>
    );
};

const Machine = ({
    children,
    className,
    ...props
}: ComponentPropsWithoutRef<'div'>) => (
    <div className={classNames('receipt-printer-machine', className)} {...props}>
        {children}
        <div aria-hidden="true" className="receipt-printer-slot" />
    </div>
);

const Header = ({
    children,
    className,
    ...props
}: ComponentPropsWithoutRef<'div'>) => (
    <div className={classNames('receipt-printer-header', className)} {...props}>
        {children}
    </div>
);

const Screen = ({
    children,
    className,
    ...props
}: ComponentPropsWithoutRef<'div'>) => (
    <div className={classNames('receipt-printer-screen', className)} {...props}>
        <div>{children}</div>
    </div>
);

const StatusIndicator = ({
    animate,
    move,
    stage,
}: {
    animate: boolean;
    move: boolean;
    stage: ReceiptPrinterStage;
}) => {
    const complete = stage === 'complete';
    return (
        <span aria-hidden="true" className="receipt-printer-indicator">
            <AnimatePresence initial={false}>
                <motion.span
                    animate={{ opacity: 1, transform: 'scale(1)' }}
                    className={complete ? 'complete' : 'working'}
                    exit={{
                        opacity: animate ? 0 : 1,
                        transform: move ? 'scale(0.96)' : 'scale(1)',
                    }}
                    initial={{
                        opacity: animate ? 0 : 1,
                        transform: move ? 'scale(0.94)' : 'scale(1)',
                    }}
                    key={complete ? 'complete' : 'working'}
                    transition={{ duration: animate ? 0.16 : 0, ease: easeOut }}
                >
                    {complete ? (
                        <CheckCircle size={18} weight="fill" />
                    ) : (
                        <CircleNotch
                            className={animate ? 'receipt-printer-spinner' : ''}
                            size={18}
                            weight="bold"
                        />
                    )}
                </motion.span>
            </AnimatePresence>
        </span>
    );
};

const Status = ({
    children,
    className,
    ...props
}: Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
    children?: ReactNode;
}) => {
    const { animate, shouldMove, stage } = useReceiptPrinter(
        'ReceiptPrinter.Status',
    );
    const label =
        children ||
        ({
            processing: 'Processing your order',
            printing: 'Printing your receipt',
            complete: 'Order complete',
        } as const)[stage];
    return (
        <div className={classNames('receipt-printer-status', className)} {...props}>
            <StatusIndicator animate={animate} move={shouldMove} stage={stage} />
            <div aria-live="polite" role="status">
                <AnimatePresence initial={false}>
                    <motion.div
                        animate={{ opacity: 1, transform: 'translateY(0px)' }}
                        exit={{
                            opacity: animate ? 0 : 1,
                            transform: shouldMove
                                ? 'translateY(-4px)'
                                : 'translateY(0px)',
                        }}
                        initial={{
                            opacity: animate ? 0 : 1,
                            transform: shouldMove
                                ? 'translateY(4px)'
                                : 'translateY(0px)',
                        }}
                        key={stage}
                        transition={{ duration: animate ? 0.18 : 0, ease: easeOut }}
                    >
                        {label}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

const Paper = ({
    children,
    className,
    style,
    ...props
}: ComponentPropsWithoutRef<'article'>) => (
    <article
        className={classNames('receipt-printer-paper', className)}
        style={{ clipPath: receiptClipPath, ...style }}
        {...props}
    >
        {children}
    </article>
);

const Output = ({
    children,
    className,
    ...props
}: ComponentPropsWithoutRef<'div'>) => {
    const { animate, feedMotion, shouldMove, stage } = useReceiptPrinter(
        'ReceiptPrinter.Output',
    );
    const visible = stage !== 'processing';
    const stepped = feedMotion === 'stepped' && stage === 'printing' && shouldMove;
    return (
        <div className={classNames('receipt-printer-output', className)} {...props}>
            {visible && <div aria-hidden="true" className="receipt-paper-shadow" />}
            <motion.div
                animate={{
                    opacity: visible ? 1 : 0,
                    transform:
                        stage === 'printing' && shouldMove
                            ? stepped
                                ? printingTransformKeyframes
                                : 'translateY(0%)'
                            : visible || !shouldMove
                              ? 'translateY(0%)'
                              : 'translateY(calc(-100% + 2px))',
                }}
                aria-hidden={stage !== 'complete'}
                className="receipt-paper-motion"
                initial={false}
                transition={{
                    opacity: { duration: animate ? 0.16 : 0, ease: easeOut },
                    transform: {
                        duration: shouldMove ? 1.75 : 0,
                        ease: stepped ? 'linear' : easeInOut,
                        times: stepped ? printingKeyframeTimes : undefined,
                    },
                }}
            >
                {children}
            </motion.div>
        </div>
    );
};

export const ReceiptPrinter = {
    Header,
    Machine,
    Output,
    Paper,
    Root,
    Screen,
    Status,
};
