import { 
    User, UserCircle, Stethoscope, Briefcase, BadgePlus, Phone, ShieldPlus, SquareActivity, Hexagon, Sparkles
} from "lucide-react";

export const CHAT_BG_MAP = {
    default: "bg-white",
    gray_light: "bg-gray-50",
    blue_light: "bg-blue-50",
    teal_light: "bg-teal-50",
    amber_light: "bg-amber-50",
    rose_light: "bg-rose-50",
    purple_light: "bg-purple-50",
    slate_light: "bg-slate-50",
};

export const CHAT_BG_LABELS = {
    default: "Trắng (Mặc định)",
    gray_light: "Xám nhạt",
    blue_light: "Xanh dương",
    teal_light: "Xanh ngọc",
    amber_light: "Vàng nhạt",
    rose_light: "Hồng nhạt",
    purple_light: "Tím nhạt",
    slate_light: "Ghi xám"
};

export const AVATAR_ICONS = [
    { id: "default_user", icon: UserCircle, label: "Mặc định", color: "text-gray-500", bg: "bg-gray-100" },
    { id: "staff_male", icon: User, label: "Nhân viên", color: "text-blue-600", bg: "bg-blue-100" },
    { id: "doc_stethoscope", icon: Stethoscope, label: "Bác sĩ", color: "text-teal-600", bg: "bg-teal-100" },
    { id: "nurse_cross", icon: BadgePlus, label: "Điều dưỡng", color: "text-rose-600", bg: "bg-rose-100" },
    { id: "admin_briefcase", icon: Briefcase, label: "Hành chính", color: "text-amber-600", bg: "bg-amber-100" },
    { id: "tele_phone", icon: Phone, label: "Tổng đài", color: "text-indigo-600", bg: "bg-indigo-100" },
    { id: "sec_shield", icon: ShieldPlus, label: "Bảo vệ", color: "text-emerald-600", bg: "bg-emerald-100" },
    { id: "tech_activity", icon: SquareActivity, label: "Kỹ thuật", color: "text-cyan-600", bg: "bg-cyan-100" },
    { id: "leader_sparkles", icon: Sparkles, label: "Quản lý", color: "text-fuchsia-600", bg: "bg-fuchsia-100" },
    { id: "system_hex", icon: Hexagon, label: "Hệ thống", color: "text-slate-600", bg: "bg-slate-100" },
];
