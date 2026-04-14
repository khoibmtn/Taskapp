import { Download, FileText, FileSpreadsheet, File } from "lucide-react";

const FILE_ICONS = {
    "application/pdf": FileText,
    "application/msword": FileText,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": FileText,
    "application/vnd.ms-excel": FileSpreadsheet,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileSpreadsheet,
};

function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentPreview({ attachment, isImage }) {
    if (!attachment) return null;

    if (isImage) {
        return (
            <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block">
                <img
                    src={attachment.url}
                    alt={attachment.name}
                    loading="lazy"
                    className="max-w-[240px] max-h-[300px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                />
            </a>
        );
    }

    const IconComponent = FILE_ICONS[attachment.contentType] || File;

    return (
        <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg bg-white/60 border border-gray-200 hover:bg-gray-50 transition-colors max-w-[280px]"
        >
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                <IconComponent className="w-5 h-5 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{attachment.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(attachment.size)}</p>
            </div>
            <Download className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </a>
    );
}
