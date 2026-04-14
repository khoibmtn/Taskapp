import { 
    User, UserCircle, Stethoscope, Briefcase, BadgePlus, Phone, ShieldPlus, SquareActivity, Hexagon, Sparkles,
    Smile, Baby, Bot, Cat, Dog, Rabbit, Bird, Snail, Bug, Leaf, Trees, Flower, Flame, Sun, Moon,
    Ghost, Skull, Cpu, Pizza, Coffee, Gamepad2, Rocket, Crown, Heart, Zap
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
    // Chuyên môn & Con người
    { id: "default_user", icon: UserCircle, label: "Mặc định", color: "text-gray-500", bg: "bg-gray-100" },
    { id: "staff_male", icon: User, label: "Nhân viên", color: "text-blue-600", bg: "bg-blue-100" },
    { id: "doc_stethoscope", icon: Stethoscope, label: "Bác sĩ", color: "text-teal-600", bg: "bg-teal-100" },
    { id: "nurse_cross", icon: BadgePlus, label: "Điều dưỡng", color: "text-rose-600", bg: "bg-rose-100" },
    { id: "admin_briefcase", icon: Briefcase, label: "Hành chính", color: "text-amber-600", bg: "bg-amber-100" },
    { id: "smile", icon: Smile, label: "Vui vẻ", color: "text-yellow-500", bg: "bg-yellow-100" },
    { id: "baby", icon: Baby, label: "Em bé", color: "text-pink-500", bg: "bg-pink-100" },
    
    // Động vật & Sinh vật
    { id: "cat", icon: Cat, label: "Mèo", color: "text-orange-500", bg: "bg-orange-100" },
    { id: "dog", icon: Dog, label: "Chó", color: "text-amber-700", bg: "bg-amber-100" },
    { id: "rabbit", icon: Rabbit, label: "Thỏ", color: "text-slate-600", bg: "bg-slate-100" },
    { id: "bird", icon: Bird, label: "Chim", color: "text-sky-500", bg: "bg-sky-100" },
    { id: "snail", icon: Snail, label: "Ốc sên", color: "text-lime-600", bg: "bg-lime-100" },
    { id: "bug", icon: Bug, label: "Bọ kẹp kìm", color: "text-red-700", bg: "bg-red-100" },

    // Biểu tượng Meme / Vui nhộn
    { id: "ghost", icon: Ghost, label: "Ám ảnh", color: "text-indigo-400", bg: "bg-indigo-100" },
    { id: "cpu", icon: Cpu, label: "Công nghệ", color: "text-emerald-500", bg: "bg-emerald-100" },
    { id: "skull", icon: Skull, label: "Khô cốt", color: "text-gray-800", bg: "bg-gray-200" },
    { id: "bot", icon: Bot, label: "Robot", color: "text-blue-500", bg: "bg-blue-100" },
    
    // Thiên nhiên & Đồ vật
    { id: "flower", icon: Flower, label: "Hoa", color: "text-fuchsia-500", bg: "bg-fuchsia-100" },
    { id: "leaf", icon: Leaf, label: "Lá", color: "text-green-600", bg: "bg-green-100" },
    { id: "flame", icon: Flame, label: "Lửa", color: "text-red-500", bg: "bg-red-100" },
    { id: "coffee", icon: Coffee, label: "Cà phê", color: "text-stone-600", bg: "bg-stone-200" },
    { id: "pizza", icon: Pizza, label: "Pizza", color: "text-amber-500", bg: "bg-amber-100" },
    { id: "gamepad", icon: Gamepad2, label: "Game thủ", color: "text-violet-500", bg: "bg-violet-100" },
    { id: "rocket", icon: Rocket, label: "Tên lửa", color: "text-indigo-600", bg: "bg-indigo-100" },
    { id: "crown", icon: Crown, label: "Vua", color: "text-yellow-600", bg: "bg-yellow-200" },
];
