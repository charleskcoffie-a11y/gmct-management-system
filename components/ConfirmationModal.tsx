// Deprecated: Use ToastProvider's showConfirm instead for modern confirmation dialogs.
// Legacy compatibility: accept props but render nothing.
type Props = {
	isOpen?: boolean;
	onClose?: () => void;
	onConfirm?: () => void | Promise<void>;
	title?: string;
	message?: string;
	confirmButtonText?: string;
};

export default function ConfirmationModal(_: Props) { return null; }