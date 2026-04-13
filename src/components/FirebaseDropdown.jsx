import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

/**
 * Firebase Console-style dropdown.
 * Clean text + chevron, floating menu on click.
 */
export default function FirebaseDropdown({ value, options, onChange, className = "" }) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const selected = options.find(o => o.value === value);

    return (
        <div ref={ref} className={`relative inline-block ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors min-h-[36px] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
                <span className="truncate">{selected?.label || value}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute left-0 top-full mt-1 w-auto min-w-[160px] bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 animate-in fade-in slide-in-from-top-1 duration-100">
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors min-h-[36px] ${
                                opt.value === value
                                    ? 'text-primary-700 bg-primary-50 font-medium'
                                    : 'text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <span className="w-4 flex-shrink-0">
                                {opt.value === value && <Check className="w-4 h-4 text-primary-600" />}
                            </span>
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
